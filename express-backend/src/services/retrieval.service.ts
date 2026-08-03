import { Document } from "@langchain/core/documents";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import axios from "axios";
import { logger } from "../utils/logger";
import { SearchChunk } from "./llm.service";
import { denseSearch } from "./retrieval/dense.service";
import { fuseResults } from "./retrieval/rrf.service";
import { sparseSearch } from "./retrieval/sparse.service";
import {  getGroqFastLLM, getGroqLLM } from "../utils/llm-provider";

// --- Pipeline config ---
const RRF_CANDIDATE_POOL_SIZE = 25;
const MAX_QUERY_VARIANTS = 3;

// Time caps for each external API call.
// Without these the pipeline can hang indefinitely when an API is slow / rate-limited.
const EXPANSION_TIMEOUT_MS = 3_000; // Groq is fast — 3 s is generous
const RERANK_TIMEOUT_MS = 15_000; // Voyage reranker

/**
 * Races `promise` against a timer that resolves to `fallback`.
 * Used so that a slow API never blocks the rest of the pipeline.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Expands the user query into 2-3 variants using a fast Groq LLM.
 *
 * Why Groq instead of Gemini here?
 * Gemini can take 5-10 s when rate-limited. Groq (llama3-8b-8192) typically
 * responds in <500 ms for short JSON outputs — which makes expansion nearly
 * free in latency terms. We still have a 3 s timeout as a safety net,
 * and fall back to [rawQuery] if anything goes wrong.
 */
async function expandQuery(rawQuery: string): Promise<string[]> {
  const prompt = PromptTemplate.fromTemplate(
    `You are a search query assistant. Rewrite the user query for better semantic retrieval,
then provide 2 alternative phrasings capturing the same intent.
Return ONLY a JSON array of strings — no markdown, no explanation.

User Query: {query}`,
  );

  // Try the fast 8b model first; if it fails, try the 70b model
  const llms = [getGroqFastLLM(0.1), getGroqLLM(0.1)];

  for (const llm of llms) {
    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser(),
    ]);
    try {
      const raw = await withTimeout(
        chain.invoke({ query: rawQuery }),
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
        return Array.from(new Set([rawQuery, ...variants])).slice(
          0,
          MAX_QUERY_VARIANTS,
        );
      }
    } catch (err: any) {
      logger.warn(`[Retrieval] Query expansion attempt failed: ${err.message}`);
    }
  }

  return [rawQuery];
}

/**
 * Reranks candidate documents using Voyage AI's rerank-2 model.
 * Falls back to the original RRF order if Voyage is unavailable or slow.
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
        top_k: topK,
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
    // Non-fatal: fall back to RRF order, assign a neutral score so the
    // answer is still generated (just without reranking).
    logger.warn(
      `[Retrieval] Reranking failed, using RRF order: ${err.message}`,
    );
    return documents.slice(0, topK).map(
      (doc) =>
        new Document({
          pageContent: doc.pageContent,
          metadata: { ...doc.metadata, rerankScore: 0 },
        }),
    );
  }
}

/**
 * Full hybrid retrieval pipeline:
 *
 *  1. Query expansion  — Groq (fast), 3 s timeout, falls back to original query
 *  2. Parallel search  — dense (pgvector cosine) + sparse (BM25/tsvector)
 *  3. RRF fusion       — merges & deduplicates all result lists
 *  4. Voyage rerank    — re-scores top-25 candidates, returns final top-K
 *
 * Every external API call has an explicit timeout so the pipeline always
 * resolves within a bounded time window.
 */
export async function retrieveContext(
  chatbotId: string,
  rawQuery: string,
  finalTopK = 8,
): Promise<SearchChunk[]> {
  const t0 = Date.now();

  // 1. Query expansion (with timeout)
  const querySet = await expandQuery(rawQuery);
  logger.info(`[Retrieval] ${querySet.length} query variant(s)`);

  // 2. Parallel dense + sparse search
  const [denseHits, ...sparseHitArrays] = await Promise.all([
    denseSearch(chatbotId, rawQuery, 25),
    ...querySet.map((q) => sparseSearch(chatbotId, q, 25)),
  ]);
  logger.info(
    `[Retrieval] Dense: ${denseHits.length} | Sparse: ${sparseHitArrays.flat().length} total`,
  );

  // 3. RRF fusion — merge all ranked lists into one deduplicated ranking
  const fused = fuseResults([denseHits, ...sparseHitArrays]);
  const candidates = fused.slice(0, RRF_CANDIDATE_POOL_SIZE).map(
    (h) =>
      new Document({
        pageContent: h.content,
        metadata: { id: h.id, heading: h.heading, url: h.url },
      }),
  );

  if (candidates.length === 0) {
    logger.warn(
      `[Retrieval] No candidates after fusion for chatbot ${chatbotId}`,
    );
    return [];
  }

  // 4. Reranking (falls back to RRF order on error)
  const reranked = await rerankWithVoyage(rawQuery, candidates, finalTopK);

  const result: SearchChunk[] = reranked.map((doc) => ({
    content: doc.pageContent,
    heading: doc.metadata.heading ?? undefined,
    url: doc.metadata.url,
    semantic_score: doc.metadata.rerankScore ?? 0,
  }));

  logger.info(
    `[Retrieval] Pipeline done in ${Date.now() - t0}ms | ${result.length} chunks`,
  );
  return result;
}
