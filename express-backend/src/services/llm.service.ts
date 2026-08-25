import axios from "axios";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { logger } from "../utils/logger";
import { getGeminiLLM, getGroqLLM, getCustomLLM } from "../utils/llm-provider";

export interface ChatbotContext {
  name: string;
  systemPrompt?: string;
}

export interface SearchChunk {
  content: string;
  heading?: string;
  url: string;
  semantic_score?: number;
}

export interface SourceDetail {
  url: string;
  heading?: string;
  score: number;
}

export interface LLMOptions {
  customModel?: string;
  customApiKey?: string;
}

// How long to wait for a single LLM attempt before giving up and trying the next provider.
const GENERATION_TIMEOUT_MS = 12_000; // 12 s

/**
 * Strips `<think>...</think>` tags
 */

/** Extracts and strips <think>...</think> blocks from text */
function stripThinking(text: string): { clean: string; thinking: string } {
  const thinkingRegex = /<think>[\s\S]*?<\/think>/g;
  const thinkingMatch = text.match(thinkingRegex);
  const thinking = thinkingMatch
    ? thinkingMatch
        .map((m) => m.replace(/^<think>|<\/think>$/g, "").trim())
        .filter(Boolean)
        .join("\n\n")
    : "";
  const clean = text.replace(thinkingRegex, "").trim();
  return { clean, thinking };
}

/**
 * Rejects after `ms` milliseconds with a timeout error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`LLM call timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

/**
 * Generates a chatbot answer using retrieved context chunks.
 *
 * Provider waterfall (fastest response wins):
 *   1. Gemini 2.0 Flash  — primary, 12 s timeout
 *   2. Groq key-A        — fallback if Gemini rate-limits or times out
 *   3. Groq key-B        — second Groq key (next in round-robin)
 *
 * When `options.customApiKey` is set the user's own model is used instead of
 * the platform waterfall. Claude models are routed via Anthropic's REST API
 * (axios); all other custom models go through LangChain's getCustomLLM().
 *
 * When `streamCallback` is provided, LangChain's `.stream()` is used and each
 * text chunk is forwarded to the callback in real-time. The full accumulated
 * answer is still returned for persistence.
 */
export async function generateAnswer(
  query: string,
  chunks: SearchChunk[],
  chatbot: ChatbotContext,
  options?: LLMOptions,
  streamCallback?: (chunk: string) => void,
): Promise<{
  answer: string;
  thinking: string;
  sources: string[];
  sourceDetails: SourceDetail[];
}> {
  // Collect sources for the response
  const sourceDetails: SourceDetail[] = chunks.map((c) => ({
    url: c.url,
    heading: c.heading ?? undefined,
    score: c.semantic_score ?? 0,
  }));
  const sources = Array.from(new Set(chunks.map((c) => c.url)));

  // Format retrieved context
  const context =
    chunks.length > 0
      ? chunks
          .map(
            (c, i) =>
              `[Source ${i + 1}] ${c.heading ?? "Page"}\nURL: ${c.url}\n${c.content}`,
          )
          .join("\n\n---\n\n")
      : "(No relevant context found — answer from general knowledge if possible)";

  const systemInstructions =
    chatbot.systemPrompt ??
    `You are ${chatbot.name}, an expert website assistant. Answer the user's question using the provided context. If the context doesn't contain enough information, say so politely.`;

  const prompt = PromptTemplate.fromTemplate(`{systemInstructions}

CONTEXT FROM WEBSITE:
{context}

USER QUESTION: {query}

Answer:`);

  const promptInput = { systemInstructions, context, query };

  // ── Custom user-supplied API key ─────────────────────────────────────────────
  if (options?.customApiKey && options?.customModel) {
    const { customModel, customApiKey } = options;

    // Claude models: call Anthropic REST API directly (no LangChain package needed)
    if (customModel.startsWith("claude")) {
      try {
        const fullPrompt = `${systemInstructions}\n\nCONTEXT FROM WEBSITE:\n${context}\n\nUSER QUESTION: ${query}\n\nAnswer:`;

        if (streamCallback) {
          // Use Anthropic streaming API
          const response = await axios.post(
            "https://api.anthropic.com/v1/messages",
            {
              model: customModel,
              max_tokens: 1024,
              stream: true,
              messages: [{ role: "user", content: fullPrompt }],
            },
            {
              headers: {
                "x-api-key": customApiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              responseType: "stream",
            },
          );

          let fullAnswer = "";
          await new Promise<void>((resolve, reject) => {
            response.data.on("data", (rawChunk: Buffer) => {
              const lines = rawChunk.toString().split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === "[DONE]") continue;
                try {
                  const event = JSON.parse(jsonStr);
                  if (
                    event.type === "content_block_delta" &&
                    event.delta?.type === "text_delta"
                  ) {
                    const text: string = event.delta.text ?? "";
                    fullAnswer += text;
                    streamCallback(text);
                  }
                } catch {
                  // ignore malformed SSE lines
                }
              }
            });
            response.data.on("end", resolve);
            response.data.on("error", reject);
          });

          logger.info(
            `[LLM] Answer via Claude (stream) | model: ${customModel}`,
          );
          return { answer: fullAnswer, thinking: "", sources, sourceDetails };
        } else {
          // Non-streaming Anthropic call
          const response = await axios.post(
            "https://api.anthropic.com/v1/messages",
            {
              model: customModel,
              max_tokens: 1024,
              messages: [{ role: "user", content: fullPrompt }],
            },
            {
              headers: {
                "x-api-key": customApiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
            },
          );

          const answer: string = response.data.content[0].text;
          logger.info(`[LLM] Answer via Claude | model: ${customModel}`);
          return { answer, thinking: "", sources, sourceDetails };
        }
      } catch (err: any) {
        logger.warn(
          `[LLM] Claude (${customModel}) failed: ${err.message} — falling through to platform waterfall`,
        );
      }
    } else {
      // Non-claude custom model via LangChain
      try {
        const llm = getCustomLLM(customModel, customApiKey);
        const chain = RunnableSequence.from([
          prompt,
          llm,
          new StringOutputParser(),
        ]);

        if (streamCallback) {
          const stream = await chain.stream(promptInput);
          let fullAnswer = "";
          for await (const chunk of stream) {
            streamCallback(chunk);
            fullAnswer += chunk;
          }
          logger.info(
            `[LLM] Answer via custom model (stream) | model: ${customModel}`,
          );
          return { answer: fullAnswer, thinking: "", sources, sourceDetails };
        } else {
          const answer = await withTimeout(
            chain.invoke(promptInput),
            GENERATION_TIMEOUT_MS,
          );
          logger.info(`[LLM] Answer via custom model | model: ${customModel}`);
          return { answer, thinking: "", sources, sourceDetails };
        }
      } catch (err: any) {
        logger.warn(
          `[LLM] Custom model (${customModel}) failed: ${err.message} — falling through to platform waterfall`,
        );
      }
    }
  }

  // ── Platform waterfall: Gemini → Groq-1 → Groq-2 ───────────────────────────
  const providers: Array<{
    name: string;
    getLLM: () =>
      | ReturnType<typeof getGeminiLLM>
      | ReturnType<typeof getGroqLLM>;
  }> = [
    { name: "Gemini", getLLM: () => getGeminiLLM(0.2) },
    { name: "Groq-1", getLLM: () => getGroqLLM(0.2) },
    { name: "Groq-2", getLLM: () => getGroqLLM(0.2) }, // Round-robin picks the next key
  ];

  for (const { name, getLLM } of providers) {
    try {
      const chain = RunnableSequence.from([
        prompt,
        getLLM(),
        new StringOutputParser(),
      ]);

      if (streamCallback) {
        const stream = await chain.stream(promptInput);
        let fullAnswer = "";
        let inThinking = false;
        let buf = "";

        for await (const chunk of stream) {
          buf += chunk;
          fullAnswer += chunk;

          // Flush non-thinking text from buffer
          while (buf.length > 0) {
            if (!inThinking) {
              const thinkIdx = buf.indexOf("<think>");
              if (thinkIdx >= 0) {
                if (thinkIdx > 0) streamCallback(buf.substring(0, thinkIdx));
                buf = buf.substring(thinkIdx + 7);
                inThinking = true;
              } else {
                // Hold back last 6 chars in case `<think>` is split across chunks
                const safe = Math.max(0, buf.length - 6);
                if (safe > 0) {
                  streamCallback(buf.substring(0, safe));
                  buf = buf.substring(safe);
                }
                break;
              }
            } else {
              const endIdx = buf.indexOf("</think>");
              if (endIdx >= 0) {
                buf = buf.substring(endIdx + 8);
                inThinking = false;
              } else {
                break;
              }
            }
          }
        }

        // Flush any remaining buffer
        if (!inThinking && buf.length > 0) streamCallback(buf);

        const { clean, thinking } = stripThinking(fullAnswer);
        logger.info(
          `[LLM] Answer via ${name} (stream) | chunks: ${chunks.length}`,
        );
        return { answer: clean, thinking, sources, sourceDetails };
      } else {
        const rawAnswer = await withTimeout(
          chain.invoke(promptInput),
          GENERATION_TIMEOUT_MS,
        );
        const { clean, thinking } = stripThinking(rawAnswer);
        logger.info(`[LLM] Answer via ${name} | chunks: ${chunks.length}`);
        return { answer: clean, thinking, sources, sourceDetails };
      }
    } catch (err: any) {
      logger.warn(
        `[LLM] ${name} failed (${err.message}) — trying next provider`,
      );
    }
  }

  // All providers failed — return a graceful error message instead of a 500
  logger.error("[LLM] All providers exhausted — returning fallback message");
  const fallbackAnswer =
    "I'm having trouble connecting to my AI service right now. Please try again in a moment.";
  if (streamCallback) streamCallback(fallbackAnswer);
  return { answer: fallbackAnswer, thinking: "", sources, sourceDetails };
}
