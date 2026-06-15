import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import axios from "axios";
import { logger } from "./logger";

// Voyage AI limits: max 128 texts per request; we use 96 for safety headroom.
const VOYAGE_BATCH_SIZE = 96;
// 30 s is generous enough for a 96-item batch even on slow connections.
const VOYAGE_TIMEOUT_MS = 30_000;

/**
 * LangChain-compatible wrapper around the Voyage AI REST embeddings API.
 *
 * Key improvements over the previous version:
 *  - Batches large document sets so we never exceed Voyage's per-request limit.
 *  - Uses a 30 s timeout (was 10 s — too short for batches of many chunks).
 *  - Accepts a `model` override for future flexibility.
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

  /** Low-level: send one batch to Voyage AI and return embeddings. */
  private async callApi(texts: string[]): Promise<number[][]> {
    const response = await axios.post(
      "https://api.voyageai.com/v1/embeddings",
      { input: texts, model: this.model },
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: VOYAGE_TIMEOUT_MS,
      },
    );

    if (!response.data?.data) {
      throw new Error("Invalid response structure from Voyage API");
    }

    return response.data.data.map(
      (item: { embedding: number[] }) => item.embedding,
    );
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
        const embeddings = await this.callApi(batch);
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

  /** Embed a single query string. */
  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.callApi([text]);
    return embedding ?? [];
  }
}
