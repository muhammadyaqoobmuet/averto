import { Document } from "@langchain/core/documents";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import axios from "axios";
import { logger } from "../utils/logger";
import { SearchChunk } from "./llm.service";
import { denseSearchMultiVariant, shouldExpandQuery } from "./retrieval/dense.service";
import { fuseResults, normalizeRrfScore, WeightedList } from "./retrieval/rrf.service";
import { sparseSearch } from "./retrieval/sparse.service";
import { getAlibabaFastLLM, getGroqFastLLM } from "../utils/llm-provider";
import { RawVoyageEmbeddings } from "../utils/voyage";
import {
  getCachedRetrieval,
  retrievalCacheKey,
  setCachedRetrieval,
} from "../lib/retrieval-cache";

// ── Pipeline config ──────────────────────────────────────────────────────────

/**
 * How many fused candidates get sent to the cross-encoder.
 *
 * 25 → 40. Reranking is cheap (~300 ms for 40 short chunks) and it is the
 * single biggest accuracy lever in the pipeline: it sees actual query-chunk
 * interaction rather than relying on a bag-of-words or cosine approximation.
 * A wider candidate pool strictly increases the chance the truly-relevant
 * chunk survives to the final selection.
 */
const RRF_CANDIDATE_POOL_SIZE = 40;

/** Max paraphrases from the expander, including the original query. */
const MAX_QUERY_VARIANTS = 3;

/** Results fetched per channel per variant. */
const PER_CHANNEL_LIMIT = 25;

/**
 * Channel weights for weighted RRF.
 *
 * Dense > sparse, because cosine similarity over the full corpus reflects
 * meaning, whereas `ts_rank_cd` on a short chunk is dominated by term
 * frequency and will happily rank a chunk that repeats the query words three
 * times above one that actually answers the question.
 *
 * Within sparse, the raw query outranks LLM paraphrases — the paraphrases are
 * guesses and should corroborate, not override, what the user actually typed.
 */
const DENSE_WEIGHT = 1.0;
const SPARSE_RAW_WEIGHT = 0.6;
const SPARSE_VARIANT_WEIGHT = 0.4;

// Time caps for each external API call.
// Without these a slow/rate-limited provider leaves the request hanging until
// the HTTP client gives up, which is minutes rather than seconds.
const EXPANSION_TIMEOUT_MS = 3_000;
const RERANK_TIMEOUT_MS = 8_000;

/**
 * Similarity ceiling for "this text is essentially a repeat of that text".
 *
 * Above this we treat two chunks as redundant and keep only one. Tuned for
 * chunk-level text where boilerplate nav blocks genuinely repeat verbatim
 * across pages — the exact failure mode where 8 slots get filled with 2
 * distinct facts repeated four times each.
 */
const NEAR_DUPLICATE_THRESHOLD = 0.9;

/**
 * Races `promise` against a timer that resolves to `fallback`, and ABORTS the
 * underlying work on timeout.
 *
 * The old version only raced the promise. The losing work kept running: a
 * Voyage rerank that had already been dispatched kept its HTTP socket open
 * and kept being billed, with nobody reading the response. Passing an
 * `AbortSignal` into axios lets us actually cancel it.
 */
function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    task(controller.signal).finally(() => clearTimeout(timer)),
    new Promise<T>((resolve) =>
      setTimeout(() => {
        clearTimeout(timer);
        controller.abort();
        resolve(fallback);
      }, ms),
    ),
  ]);
}

/**
 * Expands the user query into 2-3 alternative phrasings using a fast LLM.
 *
 * Why Groq instead of Gemini? Gemini can take 5-10 s when rate-limited. Groq
 * responds in a few hundred ms for short JSON output, which matters because
 * this call sits on the critical path. We keep a 3 s timeout as a safety net
 * and fall back to the original query if anything goes wrong.
 *
 * `signal` is threaded into the underlying request so a client disconnect
 * cancels this work instead of leaving it burning tokens.
 */
async function expandQuery(
  rawQuery: string,
  signal: AbortSignal,
): Promise<string[]> {
  // Long or very short queries don't benefit — see shouldExpandQuery.
  if (!shouldExpandQuery(rawQuery)) {
    logger.debug("[Retrieval] Skipping expansion (query length out of range)");
    return [rawQuery];
  }

  const prompt = PromptTemplate.fromTemplate(
    `You are a search query assistant. Rewrite the user query for better semantic retrieval,
then provide 2 alternative phrasings capturing the same intent.
Return ONLY a JSON array of strings — no markdown, no explanation.

User Query: {query}`,
  );

  // Alibaba first, Groq as backup.
  //
  // Expansion generates paraphrases, not facts, so the grounding differences
  // between the models do not apply here — only speed and reliability do.
  // Alibaba measured ~0.9 s with no rate limiting, while Groq was returning
  // 429s under load, so leading with Alibaba takes pressure off the provider
  // we now rely on for final answers.
  //
  // Each attempt is bounded and any failure degrades to the next.
  for (const [label, buildChain] of [
    ["aliyun", () => getAlibabaFastLLM(0.1)],
    ["groq", () => getGroqFastLLM(0.1)],
  ] as const) {
    try {
      const chain = RunnableSequence.from([
        prompt,
        buildChain(),
        new StringOutputParser(),
      ]);

      const raw = await withTimeout(
        (s) => chain.invoke({ query: rawQuery }, { signal: s }) as Promise<string>,
        EXPANSION_TIMEOUT_MS,
        "[]",
      );

      const jsonStr = raw.includes("[")
        ? raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1)
        : "[]";

      const parsed: unknown = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const variants = (parsed as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        );
        if (variants.length > 0) {
          return Array.from(new Set([rawQuery, ...variants])).slice(
            0,
            MAX_QUERY_VARIANTS,
          );
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        logger.debug("[Retrieval] Query expansion aborted");
      } else {
        logger.warn(
          `[Retrieval] Query expansion via ${label} failed: ${err.message}`,
        );
      }
    }
  }

  return [rawQuery];
}

/**
 * Normalised character-bigram set for near-duplicate detection.
 *
 * Character bigrams rather than words, so "contact us" and "contact
 * information" still overlap meaningfully — word-level Jaccard is far too
 * brittle for short chunks.
 */
function bigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    out.add(normalized.slice(i, i + 2));
  }
  return out;
}

/** Jaccard similarity over bigram sets. 0 = disjoint, 1 = identical. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const gram of small) if (large.has(gram)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Removes near-duplicate chunks, keeping the higher-ranked copy.
 *
 * ── The problem ────────────────────────────────────────────────────────────
 * RRF dedupes by chunk id, so two genuinely different chunks that happen to
 * contain the same boilerplate (a nav menu, a repeated footer, a product card
 * that recurs across pages) both survive and occupy final slots. The LLM then
 * receives 8 chunks carrying 2 real facts and answers from a much thinner
 * evidence base than the token count suggests.
 *
 * Only chunks Jaccard >= NEAR_DUPLICATE_THRESHOLD are dropped, so genuinely
 * different content that happens to share vocabulary is preserved.
 *
 * @param docs  - Reranked documents, best first.
 * @param limit - Max documents to return.
 */
function dedupeNearIdentical(docs: Document[], limit: number): Document[] {
  const kept: Document[] = [];
  const keptGrams: Set<string>[] = [];

  for (const doc of docs) {
    if (kept.length >= limit) break;

    const grams = bigrams(doc.pageContent);
    const isDuplicate = keptGrams.some(
      (other) => similarity(grams, other) >= NEAR_DUPLICATE_THRESHOLD,
    );

    if (isDuplicate) {
      logger.debug("[Retrieval] Dropped near-duplicate chunk");
      continue;
    }

    kept.push(doc);
    keptGrams.push(grams);
  }

  return kept;
}

/**
 * Reranks candidate documents using Voyage AI's rerank-2 cross-encoder.
 *
 * A cross-encoder reads the query and the chunk TOGETHER, so it can judge
 * "does this passage actually answer that question" — something neither
 * cosine distance nor BM25 can do. It is the strongest single accuracy
 * component here, which is why we widen the candidate pool feeding it.
 *
 * Falls back to the incoming (RRF) order if Voyage is unavailable, preserving
 * each document's RRF score as its confidence rather than collapsing every
 * score to 0 as the previous implementation did.
 */
async function rerankWithVoyage(
  query: string,
  documents: Document[],
  topK: number,
): Promise<Document[]> {
  if (documents.length === 0) return [];

  try {
    const response = await axios.post(
      "https://api.voyageai.com/v1/rerank",
      {
        query,
        documents: documents.map((d) => d.pageContent),
        model: "rerank-2",
        top_k: Math.min(topK, documents.length),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VOYAGEAI_KEY ?? process.env.VOYAGE_API_KEY}`,
        },
        timeout: RERANK_TIMEOUT_MS,
      },
    );

    return response.data.data.map(
      (item: { index: number; relevance_score: number }) => {
        const doc = documents[item.index];
        return new Document({
          pageContent: doc.pageContent,
          metadata: { ...doc.metadata, rerankScore: item.relevance_score },
        });
      },
    );
  } catch (err: any) {
    // Non-fatal. Preserve the existing RRF-derived confidence instead of
    // overwriting it with 0 — setting every score to 0 made the whole
    // "low confidence" analytics signal fire on every single query whenever
    // the reranker was unavailable.
    logger.warn(
      `[Retrieval] Reranking failed, using fused order: ${err.message}`,
    );
    return documents.slice(0, topK);
  }
}

/**
 * Full hybrid retrieval pipeline.
 *
 *   1. Parallel start  — sparse search on the raw query begins IMMEDIATELY,
 *                        alongside query expansion. The old code awaited
 *                        expansion first, making every request pay 0.6-3.0 s
 *                        before any database work started.
 *   2. Query expansion  — Groq (fast), 3 s timeout, falls back to original.
 *   3. Dense search     — pgvector cosine over ALL query variants, merged by
 *                        local RRF. Previously only the raw query was used.
 *   4. Sparse search    — tsvector over raw + variant queries.
 *   5. Weighted fusion  — merges channels with dense > sparse > paraphrase.
 *   6. Cross-encoder    — Voyage rerank-2 over a 40-candidate pool.
 *   7. Dedupe           — drops near-identical chunks before they eat the
 *                        context budget.
 *
 * Every external call has a timeout AND an abort signal, so the pipeline
 * always resolves within a bounded window and never leaks in-flight work.
 */
export async function retrieveContext(
  chatbotId: string,
  rawQuery: string,
  finalTopK = 8,
): Promise<SearchChunk[]> {
  const t0 = Date.now();

  // ── 0. Cache lookup ───────────────────────────────────────────────────────
  // Repeat questions are extremely common on a support widget and a full
  // pass costs ~0.6-2.0 s. This is the single cheapest latency win available.
  const cacheKey = retrievalCacheKey(chatbotId, rawQuery);
  const cached = await getCachedRetrieval<SearchChunk[]>(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    logger.info(
      `[Retrieval] Cache HIT | ${cached.length} chunks | ${Date.now() - t0}ms`,
    );
    return cached;
  }

  // Abort signal for the whole pipeline. Cancelled if the client disconnects.
  const pipelineController = new AbortController();

  const embedder = new RawVoyageEmbeddings({
    apiKey: process.env.VOYAGEAI_KEY ?? process.env.VOYAGE_API_KEY,
  });

  // ── 1. Start everything that does NOT depend on expansion, together ──────
  //
  // All three of these were previously serialised behind one another, costing
  // roughly (expansion 1.3 s + embedding 1.4 s) on every cold request when
  // they could overlap. None of them needs the expansion output:
  //   - sparse on the raw query needs nothing
  //   - expansion needs nothing
  //   - embedding the raw query needs nothing
  //
  // Only the PARAPHRASE embeddings have to wait for expansion, and they are
  // an accuracy bonus rather than a requirement — so the raw query's recall is
  // no longer gated on an LLM call at all.
  const rawSparsePromise = sparseSearch(
    chatbotId,
    rawQuery,
    PER_CHANNEL_LIMIT,
  );
  const expansionPromise = expandQuery(rawQuery, pipelineController.signal);
  const rawEmbedPromise = embedder
    .embedQuery(rawQuery)
    .catch((err: any) => {
      logger.warn(`[Retrieval] Query embedding failed: ${err.message}`);
      return null as number[] | null;
    });

  const [rawSparse, querySet, rawVector] = await Promise.all([
    rawSparsePromise,
    expansionPromise.catch(() => [rawQuery] as string[]),
    rawEmbedPromise,
  ]);

  logger.info(
    `[Retrieval] ${querySet.length} query variant(s) | rawSparse: ${rawSparse.length} | rawVector: ${rawVector ? "ok" : "FAILED"}`,
  );

  // ── 2. Dense over ALL variants + sparse over the paraphrases ──────────────
  const variantQueries = querySet.filter((q) => q !== rawQuery);

  // The raw query's vector is already in hand (embedded above, in parallel
  // with expansion). Only the paraphrases still need a Voyage round-trip, and
  // embedQueries batches them into a single request.
  let vectors: number[][] = [];
  if (rawVector) {
    vectors.push(rawVector);

    // Only chase paraphrases if Voyage is actually answering. If the raw
    // embedding already failed, the service is rate-limited or down, and a
    // second call would just burn another timeout — and it would be serialised
    // after the first, doubling the worst case for no expected gain.
    if (variantQueries.length > 0) {
      try {
        vectors.push(...(await embedder.embedQueries(variantQueries)));
      } catch (err: any) {
        logger.warn(`[Retrieval] Paraphrase embedding failed: ${err.message}`);
      }
    }
  } else if (variantQueries.length > 0) {
    logger.warn(
      "[Retrieval] Skipping paraphrase embedding — Voyage unavailable. Falling back to sparse-only retrieval.",
    );
  }

  let denseHits: Awaited<ReturnType<typeof denseSearchMultiVariant>> = [];
  if (vectors.length > 0) {
    try {
      denseHits = await denseSearchMultiVariant(chatbotId, vectors, PER_CHANNEL_LIMIT);
    } catch (err: any) {
      logger.warn(`[Retrieval] Dense retrieval failed: ${err.message}`);
    }
  }

  // Sparse for the paraphrased variants (raw query already done above).
  const variantSparse = await Promise.all(
    variantQueries.map((q) => sparseSearch(chatbotId, q, PER_CHANNEL_LIMIT)),
  );

  const allSparse = [rawSparse, ...variantSparse];
  logger.info(
    `[Retrieval] Dense: ${denseHits.length} | Sparse: ${allSparse.flat().length} total`,
  );

  // ── 4. Weighted fusion ────────────────────────────────────────────────────
  const lists: WeightedList[] = [
    { hits: denseHits, weight: DENSE_WEIGHT },
    { hits: rawSparse, weight: SPARSE_RAW_WEIGHT },
  ];
  variantSparse.forEach((hits) =>
    lists.push({ hits, weight: SPARSE_VARIANT_WEIGHT }),
  );

  const totalWeight =
    DENSE_WEIGHT + SPARSE_RAW_WEIGHT + variantSparse.length * SPARSE_VARIANT_WEIGHT;

  const fused = fuseResults(lists);
  const candidates = fused.slice(0, RRF_CANDIDATE_POOL_SIZE).map((h) => {
    // Map the RRF score into 0..1 up front. If the cross-encoder fails, this
    // is the confidence the caller sees, so it has to be meaningful rather
    // than a hard-coded 0.
    const rrfConfidence = normalizeRrfScore(h.rrfScore, totalWeight);
    return new Document({
      pageContent: h.content,
      metadata: {
        id: h.id,
        heading: h.heading,
        url: h.url,
        rrfScore: rrfConfidence,
      },
    });
  });

  if (candidates.length === 0) {
    logger.warn(
      `[Retrieval] No candidates after fusion for chatbot ${chatbotId}`,
    );
    return [];
  }

  // ── 5. Cross-encoder rerank ───────────────────────────────────────────────
  const reranked = await rerankWithVoyage(rawQuery, candidates, finalTopK);

  // ── 6. Dedupe near-identical chunks ───────────────────────────────────────
  const deduped = dedupeNearIdentical(reranked, finalTopK);

  const result: SearchChunk[] = deduped.map((doc) => {
    // Use the reranker's score when present, else the normalised RRF score.
    // The previous code used `?? 0`, which silently zeroed every score on the
    // reranker fallback path and made `confidence` always 0.
    const rerankScore = doc.metadata.rerankScore;
    const confidence =
      typeof rerankScore === "number"
        ? rerankScore
        : (doc.metadata.rrfScore as number) ?? 0;

    return {
      content: doc.pageContent,
      heading: doc.metadata.heading ?? undefined,
      url: doc.metadata.url,
      semantic_score: confidence,
    };
  });

  // ── 7. Cache write ────────────────────────────────────────────────────────
  // Fire-and-forget: never let a slow Redis delay the answer.
  if (result.length > 0) {
    void setCachedRetrieval(cacheKey, result);
  }

  logger.info(
    `[Retrieval] Pipeline done in ${Date.now() - t0}ms | ${result.length} chunks (from ${candidates.length} candidates)`,
  );
  return result;
}

/**
 * Clears cached retrieval results for a chatbot.
 * Called after a re-crawl or document upload, since both invalidate chunks.
 */
export { invalidateChatbotCache } from "../lib/retrieval-cache";