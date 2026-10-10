import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import axios from "axios";
import { logger } from "./logger";
import { LruCache } from "../lib/lru-cache";

// Voyage AI limits: max 128 texts per request; we use 96 for safety headroom.
const VOYAGE_BATCH_SIZE = 96;

/**
 * Timeout for DOCUMENT embedding (indexing).
 * A 96-item batch on a slow connection legitimately takes many seconds, and
 * this call runs in a background worker where nobody is waiting on it.
 */
const VOYAGE_DOC_TIMEOUT_MS = 30_000;

/**
 * Timeout for QUERY embedding (the request hot path).
 *
 * Deliberately much tighter. A query is 1-3 short strings; if Voyage has not
 * answered in a few seconds it is either rate-limited or degraded, and waiting
 * longer only delays a fallback we can serve from the sparse index. Measured
 * during a rate-limit event: a single query embedding took 25 s, which blew
 * straight through the controller's 30 s retrieval cap and produced an empty
 * context for the whole request.
 *
 * On timeout the pipeline degrades to sparse-only retrieval instead of
 * failing — the answer gets slightly worse, not absent.
 */
const VOYAGE_QUERY_TIMEOUT_MS = 4_000;

/**
 * In-process cache of query embeddings.
 *
 * Embedding the same question twice is pure waste — the vector for a given
 * string never changes for the lifetime of a process (the model is pinned).
 * This turns a ~250 ms Voyage round-trip into a Map lookup.
 *
 * Capacity 500 ≈ a few hundred distinct questions, which comfortably covers
 * a support bot's hot set. Number[] is ~1024 floats ≈ 8 KB, so 500 entries
 * is only ~4 MB.
 */
const queryEmbeddingCache = new LruCache<number[]>(500);

/**
 * Returns a cached query embedding if we've seen this exact string before.
 * Exposed so the dense-search path can check before calling Voyage.
 */
export function getCachedQueryEmbedding(text: string): number[] | undefined {
  return queryEmbeddingCache.get(text);
}

/**
 * Stores a query embedding in the hot cache.
 */
export function cacheQueryEmbedding(text: string, vector: number[]): void {
  queryEmbeddingCache.set(text, vector);
}

/**
 * LangChain-compatible wrapper around the Voyage AI REST embeddings API.
 *
 * Key properties:
 *  - Batches large document sets so we never exceed Voyage's per-request limit.
 *  - Uses a 30 s timeout (was 10 s — too short for batches of many chunks).
 *  - Accepts a `model` override for future flexibility.
 *  - Throws loudly on a malformed response instead of returning `[]`, which
 *    previously flowed downstream and made the cast to `::vector` explode
 *    somewhere far away from the real cause.
 */
export class RawVoyageEmbeddings extends Embeddings {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(params: EmbeddingsParams & { apiKey?: string; model?: string }) {
    super(params);
    // Normalise both env-var spellings so callers don't have to worry about it.
    this.apiKey =
      params.apiKey ??
      process.env.VOYAGEAI_KEY ??
      process.env.VOYAGE_API_KEY ??
      "";
    this.model = params.model ?? "voyage-3"; // voyage-3 returns 1024-dim vectors
  }

  /**
   * Low-level: send one batch to Voyage AI and return embeddings.
   *
   * Rejects if Voyage returns fewer embeddings than we sent texts. A short
   * response would silently desynchronise the caller's text↔vector pairing and
   * produce a vector array that doesn't line up with the chunk it belongs to —
   * a corrupting bug that's very hard to notice downstream. So we validate.
   */
  private async callApi(
    texts: string[],
    timeoutMs: number,
  ): Promise<number[][]> {
    const response = await axios.post(
      "https://api.voyageai.com/v1/embeddings",
      { input: texts, model: this.model },
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: timeoutMs,
      },
    );

    if (!response.data?.data) {
      throw new Error("Invalid response structure from Voyage API");
    }

    const embeddings: number[][] = response.data.data.map(
      (item: { embedding: number[] }) => item.embedding,
    );

    if (embeddings.length !== texts.length) {
      throw new Error(
        `Voyage returned ${embeddings.length} embeddings for ${texts.length} texts`,
      );
    }

    return embeddings;
  }

  /**
   * Embed an array of documents, batching automatically.
   * Throws on API error so the caller can decide how to handle failures.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += VOYAGE_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + VOYAGE_BATCH_SIZE);
      const batchNum = Math.floor(offset / VOYAGE_BATCH_SIZE) + 1;

      try {
        const embeddings = await this.callApi(batch, VOYAGE_DOC_TIMEOUT_MS);
        results.push(...embeddings);
      } catch (err: any) {
        const msg: string =
          err.response?.data?.detail ?? err.message ?? "unknown";
        logger.error(`[Voyage] Batch ${batchNum} failed: ${msg}`);
        throw new Error(`Voyage API error: ${msg}`);
      }
    }

    return results;
  }

  /**
   * Embeds MULTIPLE query strings in a single API round-trip.
   *
   * This exists because query expansion produces 2-3 phrasings and we want all
   * of them embedded. Calling `embedQuery` in a loop would mean 3 sequential
   * HTTP requests; Voyage accepts an array, so it's 1 request.
   */
  async embedQueries(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Serve from cache where we can, only call the API for the misses.
    const cached: Array<number[] | undefined> = texts.map((t) =>
      queryEmbeddingCache.get(t),
    );
    const missingIndexes = cached
      .map((v, i) => (v === undefined ? i : -1))
      .filter((i) => i !== -1);

    if (missingIndexes.length === 0) {
      logger.debug(
        `[Voyage] embedQueries served ${texts.length} query embedding(s) from cache`,
      );
      return cached as number[][];
    }

    const toFetch = missingIndexes.map((i) => texts[i]);
    const fresh = await this.callApi(toFetch, VOYAGE_QUERY_TIMEOUT_MS);

    // Splice the fresh vectors back into their original positions so the
    // caller can zip results against their own query list.
    const result: Array<number[] | undefined> = [...cached];
    fresh.forEach((vec, n) => {
      const originalIndex = missingIndexes[n];
      result[originalIndex] = vec;
      queryEmbeddingCache.set(texts[originalIndex], vec);
    });

    return result as number[][];
  }

  /**
   * Embed a single query string.
   *
   * Throws rather than returning `[]`: previously an empty response produced
   * the string "[]", which then failed the `::vector` cast inside pgvector and
   * got swallowed by a catch-all, silently removing the entire dense-retrieval
   * channel with no signal that anything had gone wrong.
   */
  async embedQuery(text: string): Promise<number[]> {
    const cached = queryEmbeddingCache.get(text);
    if (cached) return cached;

    const [embedding] = await this.callApi([text], VOYAGE_QUERY_TIMEOUT_MS);
    if (!embedding) {
      throw new Error("Voyage returned an empty embedding for the query");
    }

    queryEmbeddingCache.set(text, embedding);
    return embedding;
  }
}