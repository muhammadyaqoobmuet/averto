import { Request, Response } from "express";
import { retrieveContext } from "../services/retrieval.service";
import { generateAnswer, SearchChunk } from "../services/llm.service";
import prisma from "../lib/prisma";

const MISSED_QUERY_THRESHOLD = 0.35;
const LOW_CONFIDENCE_THRESHOLD = 0.45;

// Hard cap on the whole retrieval pipeline.
// If the pipeline exceeds this, we degrade gracefully (answer without context)
// rather than leaving the HTTP request hanging indefinitely.
const RETRIEVAL_TIMEOUT_MS = 30_000;

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
 * Main chat endpoint.
 *
 * Flow:
 *  1. Validate chatbot API key and status
 *  2. Hybrid retrieval (Query Expansion → Dense + BM25 → RRF → Voyage Rerank)
 *     — wrapped in a 30 s hard timeout so the request never hangs
 *  3. Log "Missed Queries" when confidence is low (Insights tab analytics)
 *  4. Generate LLM answer (streaming via SSE if stream=true, or JSON)
 *  5. Persist conversation history
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

    const chunkCount = await prisma.chunk.count({
      where: { chatbotId: chatbot.id },
    });
    if (chunkCount === 0) {
      return res.status(503).json({
        error:
          "Knowledge base is empty. Please wait for crawling to finish or upload documents.",
        status: chatbot.status,
      });
    }

    // 2. Hybrid retrieval with a hard timeout
    let searchChunks: SearchChunk[] = [];
    try {
      searchChunks = await withHardTimeout(
        retrieveContext(chatbot.id, query, 8),
        RETRIEVAL_TIMEOUT_MS,
      );
    } catch (err: any) {
      // Retrieval timed out or failed — still answer using LLM without context.
      console.error("[Chat] Retrieval failed:", err.message);
      searchChunks = [];
    }

    // 3. Analytics — track low-confidence queries
    const confidence =
      searchChunks.length > 0
        ? Math.max(...searchChunks.map((c) => c.semantic_score ?? 0))
        : 0;

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
          console.error("[Analytics] Failed to log missed query:", err),
        );
    }

    const llmOptions = {
      customModel: chatbot.customModel ?? undefined,
      customApiKey: chatbot.customApiKey ?? undefined,
    };

    const chatbotContext = {
      name: chatbot.name,
      systemPrompt: chatbot.systemPrompt ?? undefined,
    };

    // ── Streaming (SSE) path ────────────────────────────────────────────────────
    if (doStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const { answer, thinking, sources, sourceDetails } = await generateAnswer(
        query,
        searchChunks,
        chatbotContext,
        llmOptions,
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
      );

      if (thinking) {
        res.write(`data: ${JSON.stringify({ thinking })}\n\n`);
      }
      res.write(
        `data: ${JSON.stringify({ done: true, sources, sourceDetails, confidence })}\n\n`,
      );
      res.end();

      // 5. Persist conversation history
      let conversation = await prisma.conversation.findFirst({
        where: { chatbotId: chatbot.id, sessionId },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { chatbotId: chatbot.id, sessionId: sessionId ?? "" },
        });
      }

      await prisma.message.create({
        data: { conversationId: conversation.id, role: "user", content: query },
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: answer,
          topScore: confidence,
          sources,
        },
      });

      return;
    }

    // ── Non-streaming JSON path (default) ───────────────────────────────────────
    const { answer, thinking, sources, sourceDetails } = await generateAnswer(
      query,
      searchChunks,
      chatbotContext,
      llmOptions,
    );

    // 5. Persist conversation history
    let conversation = await prisma.conversation.findFirst({
      where: { chatbotId: chatbot.id, sessionId },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { chatbotId: chatbot.id, sessionId: sessionId ?? "" },
      });
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: query },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: answer,
        topScore: confidence,
        sources,
      },
    });

    res.json({
      answer,
      thinking,
      sources,
      sourceDetails,
      confidence,
      lowConfidence: confidence < LOW_CONFIDENCE_THRESHOLD,
    });
  } catch (error: unknown) {
    console.error("[Chat] Process error:", error);
    res.status(500).json({ error: "Failed to process chat" });
  }
};
