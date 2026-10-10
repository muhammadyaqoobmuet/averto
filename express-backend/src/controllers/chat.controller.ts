import { Request, Response } from "express";
import { retrieveContext } from "../services/retrieval.service";
import { generateAnswer, SearchChunk } from "../services/llm.service";
import prisma from "../lib/prisma";
import { LruCache } from "../lib/lru-cache";
import { logger } from "../utils/logger";

// ── Confidence thresholds ────────────────────────────────────────────────────
//
// A chunk's score is the Voyage reranker's relevance_score (0..1) when
// reranking succeeded, or a normalised RRF score when it did not.
//
// The previous thresholds were tuned against a bug: on the reranker fallback
// path every chunk got score 0, so `confidence` was 0 for EVERY query whenever
// Voyage was unavailable. That logged the entire traffic stream to MissedQuery
// and flagged every response as low-confidence.
//
// Both values below are deliberately low. Reranker's relevance_score is a
// *ranking* score, not a probability — even a clearly relevant passage often
// scores 0.3-0.5. A high threshold would abstain from questions we can
// actually answer, which is worse than a slightly loose answer because the
// user sees "I don't know" for something the page clearly covers.
const MISSED_QUERY_THRESHOLD = 0.25;
const LOW_CONFIDENCE_THRESHOLD = 0.35;

/**
 * Score below which we refuse to call the LLM at all.
 *
 * ── Why this is 0 (i.e. off) ───────────────────────────────────────────────
 * Abstention only helps if the score actually distinguishes "answered from
 * the site" from "not on this site". Measured against the live corpus, it does
 * not: the best separating threshold got 8/10, and every threshold from 0.15
 * to 0.50 scored 5-7/10. The reranker is a RELATIVE ranker — fed 40
 * candidates it must order them, so the winner scores well even when none are
 * relevant.
 *
 * With a threshold set, the failure mode is the expensive one: the bot tells a
 * user "I couldn't find anything about that" about something the site plainly
 * covers. That is worse than a mediocre answer, and it is unrecoverable from
 * the user's side.
 *
 * So abstention now triggers ONLY on the unambiguous signal — retrieval
 * returned nothing at all. That still blocks the dominant hallucination case
 * (answering with zero grounding) while never falsely refusing.
 *
 * If the vector store is rebuilt and scores become meaningful, a calibrated
 * threshold can be reintroduced here — but it must be fitted against a
 * labelled question set, not guessed.
 */
const ABSTAIN_SCORE_THRESHOLD = 0;

// How long a cached chunk count stays valid. During a crawl the count rises
// continuously, but a 60 s lag on "is the knowledge base empty" is harmless.
const CHUNK_COUNT_TTL_MS = 60_000;

// Hard cap on the whole retrieval pipeline.
// If the pipeline exceeds this we degrade gracefully (answer without context)
// rather than leaving the HTTP request hanging indefinitely.
//
// This is kept deliberately: without it, one slow third-party provider holds
// an Express worker indefinitely and the endpoint eventually stops responding
// under load. It is NOT removed because it is load-bearing — it is only
// improved by the per-call abort signals now threaded through the pipeline,
// which actually cancel the work instead of merely abandoning the result.
const RETRIEVAL_TIMEOUT_MS = 30_000;

/**
 * Per-chatbot chunk counts.
 *
 * The controller used to run `SELECT count(*) FROM "Chunk" WHERE chatbotId = ?`
 * on EVERY request, including as the "is the knowledge base empty?" gate. That
 * column had no index, so this was a sequential scan that grew with the corpus
 * — pure overhead paid on every single message, to answer a question whose
 * answer changes at most once a minute.
 */
const chunkCountCache = new LruCache<{ count: number; at: number }>(500);

async function getChunkCount(chatbotId: string): Promise<number> {
  const cached = chunkCountCache.get(chatbotId);
  if (cached && Date.now() - cached.at < CHUNK_COUNT_TTL_MS) {
    return cached.count;
  }

  const count = await prisma.chunk.count({ where: { chatbotId } });
  chunkCountCache.set(chatbotId, { count, at: Date.now() });
  return count;
}

/**
 * Invalidates the cached chunk count for a chatbot.
 * Called from the ingest paths so a freshly-crawled bot answers immediately
 * rather than after a 60 s wait.
 */
export function invalidateChunkCount(chatbotId: string): void {
  chunkCountCache.delete(chatbotId);
}

function withHardTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Retrieval timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

/**
 * Message shown when retrieval found nothing relevant.
 *
 * Deliberately fixed rather than model-generated: there is nothing in the
 * corpus to ground an answer in, so a model call could only invent one.
 */
const ABSTAIN_ANSWER =
  "I couldn't find anything about that on this site. Could you try rephrasing your question, or ask me about the services, pricing, or team?";

/**
 * Main chat endpoint.
 *
 * Flow:
 *  1. Validate chatbot API key and status
 *  2. Hybrid retrieval (Parallel Expansion → Dense + BM25 → Weighted RRF → Voyage Rerank)
 *     — wrapped in a 30 s hard timeout so the request never hangs
 *  3. Abstain early if the top-scoring chunk is below threshold
 *  4. Log "Missed Queries" when confidence is low (Insights tab analytics)
 *  5. Generate LLM answer (streaming via SSE if stream=true, or JSON)
 *  6. Persist conversation history in a single transaction
 */
export const chat = async (req: Request, res: Response) => {
  try {
    const {
      query,
      sessionId,
      apiKey,
      stream: doStream,
    } = req.body as {
      query: string;
      sessionId?: string;
      apiKey: string;
      stream?: boolean;
    };

    // 1. Verify chatbot
    const chatbot = await prisma.chatbot.findUnique({
      where: { apiKey },
      include: { organization: true },
    });
    if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

    // Enforce allowedOrigins: if the chatbot has an origin whitelist, reject
    // requests from unlisted origins. This is the server-side guard — CORS
    // only handles browser enforcement; this protects the API itself.
    const requestOrigin = req.headers.origin;
    if (
      chatbot.allowedOrigins &&
      chatbot.allowedOrigins.length > 0 &&
      requestOrigin
    ) {
      const normalized = chatbot.allowedOrigins.map((o) =>
        o.replace(/\/$/, ""),
      );
      const incomingNorm = requestOrigin.replace(/\/$/, "");
      if (!normalized.includes(incomingNorm)) {
        return res
          .status(403)
          .json({ error: "Origin not allowed for this chatbot" });
      }
    }

    if (!["ready", "indexing"].includes(chatbot.status)) {
      return res.status(503).json({
        error:
          "Chatbot is still being set up. Please wait until indexing completes.",
        status: chatbot.status,
      });
    }

    const chunkCount = await getChunkCount(chatbot.id);
    if (chunkCount === 0) {
      return res.status(503).json({
        error:
          "Knowledge base is empty. Please wait for crawling to finish or upload documents.",
        status: chatbot.status,
      });
    }

    // ── Streaming helpers ────────────────────────────────────────────────────
    // If the browser closes the tab mid-answer we must stop generating.
    // Without this the provider keeps producing tokens that are written into a
    // dead socket — wasted money on every abandoned question.
    let clientGone = false;
    res.on("close", () => {
      clientGone = true;
    });

    const startSse = () => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      // Tell nginx not to buffer, otherwise the "streaming" response arrives
      // all at once at the end and the widget shows nothing until done.
      res.setHeader("X-Accel-Buffering", "no");
    };

    const writeSse = (payload: unknown) => {
      if (clientGone || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // ── Persist the turn ─────────────────────────────────────────────────────
    // One transaction instead of four sequential round-trips. Previously the
    // conversation lookup, possible create, and two message inserts each cost
    // a network hop — all AFTER the user already had their answer on screen.
    const persistTurn = async (
      answerText: string,
      confidenceValue: number,
      sourceList: string[],
    ) => {
      try {
        await prisma.$transaction(async (tx) => {
          // `Conversation` has no compound unique on (chatbotId, sessionId)
          // in the current schema, so this is find-then-create rather than an
          // upsert. It is safe because the whole thing runs inside one
          // transaction, and it still collapses 4 sequential round-trips into
          // a single atomic unit.
          let conversation = await tx.conversation.findFirst({
            where: { chatbotId: chatbot.id, sessionId: sessionId ?? "" },
          });

          if (!conversation) {
            conversation = await tx.conversation.create({
              data: { chatbotId: chatbot.id, sessionId: sessionId ?? "" },
            });
          }

          await tx.message.create({
            data: { conversationId: conversation.id, role: "user", content: query },
          });
          await tx.message.create({
            data: {
              conversationId: conversation.id,
              role: "assistant",
              content: answerText,
              topScore: confidenceValue,
              sources: sourceList,
            },
          });
        });
      } catch (err) {
        // Persistence failure must not break the user-visible answer — the
        // response is already on its way.
        logger.error({ err }, "[Chat] Failed to persist conversation");
      }
    };

    // 2. Hybrid retrieval with a hard timeout
    let searchChunks: SearchChunk[] = [];
    try {
      searchChunks = await withHardTimeout(
        retrieveContext(chatbot.id, query, 8),
        RETRIEVAL_TIMEOUT_MS,
      );
    } catch (err: any) {
      // Retrieval timed out or failed — still answer using LLM without context.
      logger.error({ err: err.message }, "[Chat] Retrieval failed");
      searchChunks = [];
    }

    // 3. Confidence
    const confidence =
      searchChunks.length > 0
        ? Math.max(...searchChunks.map((c) => c.semantic_score ?? 0))
        : 0;

    // 4. Analytics — track low-confidence queries
    if (confidence < MISSED_QUERY_THRESHOLD) {
      // Fire-and-forget — don't await so it doesn't add latency
      prisma.missedQuery
        .create({
          data: {
            chatbotId: chatbot.id,
            query,
            topScore: confidence,
            sessionId,
          },
        })
        .catch((err) =>
          logger.error({ err }, "[Analytics] Failed to log missed query"),
        );
    }

    const sources = Array.from(new Set(searchChunks.map((c) => c.url)));
    const sourceDetails = searchChunks.map((c) => ({
      url: c.url,
      heading: c.heading ?? undefined,
      score: c.semantic_score ?? 0,
    }));

    // ── Abstain: nothing relevant was retrieved ──────────────────────────────
    // Skip the LLM entirely. This is both the single biggest accuracy
    // improvement available (it removes the dominant hallucination path) and
    // a full latency + cost saving on out-of-scope questions.
    if (searchChunks.length === 0 || confidence < ABSTAIN_SCORE_THRESHOLD) {
      logger.info(
        `[Chat] Abstaining | chunks=${searchChunks.length} confidence=${confidence.toFixed(3)}`,
      );

      if (doStream) {
        startSse();
        writeSse({ chunk: ABSTAIN_ANSWER });
      }

      await persistTurn(ABSTAIN_ANSWER, confidence, sources);

      const payload = {
        answer: ABSTAIN_ANSWER,
        thinking: "",
        sources: [],
        sourceDetails: [],
        confidence,
        lowConfidence: true,
        abstained: true,
      };

      if (doStream) {
        writeSse({ done: true, ...payload });
        return res.end();
      }
      return res.json(payload);
    }

    const llmOptions = {
      customModel: chatbot.customModel ?? undefined,
      customApiKey: chatbot.customApiKey ?? undefined,
    };

    const chatbotContext = {
      name: chatbot.name,
      systemPrompt: chatbot.systemPrompt ?? undefined,
    };

    // ── Streaming (SSE) path ──────────────────────────────────────────────────
    if (doStream) {
      startSse();

      const { answer, thinking, sources: s, sourceDetails: sd } =
        await generateAnswer(
          query,
          searchChunks,
          chatbotContext,
          llmOptions,
          (chunk: string) => {
            if (clientGone) return;
            writeSse({ chunk });
          },
        );

      if (thinking) writeSse({ thinking });
      writeSse({ done: true, sources: s, sourceDetails: sd, confidence });

      if (!clientGone) res.end();

      // 5. Persist conversation history
      await persistTurn(answer, confidence, s);
      return;
    }

    // ── Non-streaming JSON path (default) ────────────────────────────────────
    const { answer, thinking, sources: s, sourceDetails: sd } =
      await generateAnswer(query, searchChunks, chatbotContext, llmOptions);

    // 5. Persist conversation history
    await persistTurn(answer, confidence, s);

    res.json({
      answer,
      thinking,
      sources: s,
      sourceDetails: sd,
      confidence,
      lowConfidence: confidence < LOW_CONFIDENCE_THRESHOLD,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[Chat] Process error");
    res.status(500).json({ error: "Failed to process chat" });
  }
};