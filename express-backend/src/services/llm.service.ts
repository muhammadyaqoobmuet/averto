import axios from "axios";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { logger } from "../utils/logger";
import {
  isProviderUsable,
  recordProviderFailure,
  recordProviderSuccess,
} from "../lib/circuit-breaker";
import { getAlibabaLLM, getBedrockLLM, getGroqLLM, getCustomLLM } from "../utils/llm-provider";

export interface ChatbotContext {
  name: string;
  systemPrompt?: string;
}

export interface SearchChunk {
  content: string;
  heading?: string;
  url: string;
  /**
   * Confidence 0..1 for this chunk being relevant to the query.
   * Voyage reranker `relevance_score` when reranking succeeded, otherwise a
   * normalised RRF score.
   */
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

// ── Generation budget ────────────────────────────────────────────────────────

/**
 * How long to wait for ONE provider attempt before moving to the next.
 * With three providers in the waterfall the worst case is 3 × this.
 */
const GENERATION_TIMEOUT_MS = 8_000;

/**
 * Budget for the LAST fallback in the waterfall.
 * By then the user has already waited through two providers; another 12 s on
 * top is worse than returning a slightly less polished answer.
 */
const FALLBACK_TIMEOUT_MS = 8_000;

/**
 * Hard ceiling on the ENTIRE generation phase, across all providers.
 *
 * Per-provider timeouts alone allow 3 x 8 s = 24 s before we admit defeat.
 * That is the worst case a user can experience when the providers are all
 * degraded at once, and it is far too long to stare at a spinner. This budget
 * is what actually bounds the wait: once elapsed time passes it, we stop
 * trying further providers and return the fallback immediately.
 *
 * The first provider keeps its full allowance; later providers receive only
 * whatever is left. Since a healthy fallback answers in 1-2 s, a few seconds
 * is plenty, and a fast "we're having trouble" beats a slow one.
 */
const TOTAL_GENERATION_BUDGET_MS = 12_000;

/**
 * How long a streaming provider may stay silent before we give up on it.
 *
 * Time-to-first-token is what the user actually perceives: with a silent
 * provider the widget shows an empty bubble for the entire wait. Measured on
 * a degraded Gemini, first token arrived at ~15.7 s — well past the point
 * where falling through to Groq (first token in well under a second) is the
 * better experience.
 *
 * Once the first token lands the total deadline takes over, so long answers
 * are still allowed to finish.
 */
const FIRST_TOKEN_TIMEOUT_MS = 6_000;

/**
 * Hard ceiling on the whole generation phase.
 *
 * Streaming is the reason this exists. Without it, a provider that accepts the
 * connection and then stalls (or a client that stops reading) holds the HTTP
 * response open indefinitely — `GENERATION_TIMEOUT_MS` was only ever applied
 * to the non-streaming branches, so the streaming path had no bound at all.
 */
const STREAM_TOTAL_TIMEOUT_MS = 45_000;

/**
 * Uniform output cap across every provider.
 *
 * Previously only the Anthropic path set `max_tokens: 1024`; Gemini and Groq
 * were uncapped, so the same question could return 200 tokens or 4,000
 * depending on which provider happened to answer. A chatbot widget wants a
 * short, scannable answer — 1024 is generous for that.
 */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Renders retrieved chunks into the prompt context block.
 *
 * The `[Source N]` prefix is load-bearing: the answer is instructed to cite
 * it, which is what makes the sources panel clickable rather than decorative.
 */
function buildContext(chunks: SearchChunk[]): string {
  if (chunks.length === 0) {
    return "(No relevant context found — this question is not related to the website content)";
  }

  return chunks
    .map(
      (c, i) =>
        // Heading is now populated (previously always null, so every citation
        // rendered as the generic word "Page").
        `${c.heading ? `${c.heading}\n` : ""}[Source ${i + 1}]\nURL: ${c.url}\n${c.content}`,
    )
    .join("\n\n---\n\n");
}

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
 * Rejects after `ms` with a timeout error, and aborts the controller so the
 * underlying HTTP request is cancelled rather than left running.
 */
function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    task(controller.signal).finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        clearTimeout(timer);
        controller.abort();
        reject(new Error(`LLM call timed out after ${ms}ms`));
      }, ms),
    ),
  ]);
}

/**
 * Streams a LangChain runnable, forwarding text to `streamCallback`, while
 * stripping `<think>...</think>` blocks incrementally so reasoning tokens
 * never reach the user.
 *
 * ── Incremental stripping ──────────────────────────────────────────────────
 * Reasoning models interleave <think> blocks mid-answer. A regex over the
 * completed string would mean the user sees the raw reasoning stream first
 * and then it vanishes. Instead we buffer a few characters so a partially
 * received `<think>` is never leaked before we know whether it's a tag.
 */
async function streamWithThinkingStripped(
  stream: AsyncIterable<string>,
  streamCallback: (chunk: string) => void,
): Promise<{ fullAnswer: string; thinking: string }> {
  let fullAnswer = "";
  let inThinking = false;
  let buf = "";
  let leadingStripped = false;

  const sendText = (text: string) => {
    if (!text) return;
    if (!leadingStripped) {
      text = text.replace(/^\n+/, "");
      if (text) leadingStripped = true;
    }
    streamCallback(text);
  };

  for await (const chunk of stream) {
    buf += chunk;
    fullAnswer += chunk;

    // Flush whatever is safely outside a think-tag.
    while (buf.length > 0) {
      if (!inThinking) {
        const thinkIdx = buf.indexOf("<think>");
        if (thinkIdx >= 0) {
          if (thinkIdx > 0) sendText(buf.substring(0, thinkIdx));
          buf = buf.substring(thinkIdx + 7);
          inThinking = true;
        } else {
          // Hold back 6 chars: enough to catch a "<think>" that is still
          // arriving, without stalling the visible stream noticeably.
          const safe = Math.max(0, buf.length - 6);
          if (safe > 0) {
            sendText(buf.substring(0, safe));
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

  if (!inThinking && buf.length > 0) sendText(buf);

  const { clean, thinking } = stripThinking(fullAnswer);
  return { fullAnswer: clean, thinking };
}

/**
 * Generates a chatbot answer using retrieved context chunks.
 *
 * Provider waterfall (fastest response wins):
 *   1. Gemini Flash     — primary
 *   2. Groq (key round 1) — fallback on rate-limit / timeout
 *   3. Groq (key round 2) — second Groq key via round-robin
 *
 * When `options.customApiKey` is set the user's own model is used instead of
 * the platform waterfall. Claude models are routed via Anthropic's REST API
 * (axios); all other custom models go through LangChain's getCustomLLM().
 *
 * When `streamCallback` is provided the model is streamed and each text chunk
 * is forwarded to the callback in real time; `thinking` blocks are stripped
 * before forwarding.
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

  const context = buildContext(chunks);

  const systemInstructions =
    chatbot.systemPrompt ??
    `You are ${chatbot.name}, an expert website assistant for this website. ONLY answer questions directly related to the information on this website — such as services offered, projects, team members, pricing, contact info, or documentation. If the user asks a question that cannot be answered from the provided context (like general coding problems, unrelated topics, or off-topic requests), politely decline and redirect them to ask something about the website. NEVER use general knowledge to answer questions that are not covered in the context. Keep answers concise and relevant to the website content.`;

  // Note the prompt no longer ends with "Answer: {query}". The query already
  // appears under USER QUESTION, and repeating it verbatim at the end made
  // small models echo it back as the first line of the answer.
  const prompt = PromptTemplate.fromTemplate(`{systemInstructions}

CONTEXT FROM WEBSITE:
{context}

USER QUESTION: {query}

Rules:
- ONLY use information from the CONTEXT ABOVE to answer
- Cite your sources inline as [Source N] after each claim you use
- If the question is NOT about this website, say: "I can only help with questions about this website. Please ask something about our services, projects, or team."
- If the CONTEXT does not contain the answer, say you don't have that information — never guess
- Do NOT write code, solve coding problems, or answer general knowledge questions
- Keep answers short and directly related to the website
- Start your answer immediately with no leading newlines

Answer:`);

  const promptInput = { systemInstructions, context, query };

  // ── Custom user-supplied API key ─────────────────────────────────────────
  if (options?.customApiKey && options?.customModel) {
    const { customModel, customApiKey } = options;

    // Claude models: call Anthropic REST API directly (no LangChain package needed)
    if (customModel.startsWith("claude")) {
      try {
        const fullPrompt = `${systemInstructions}\n\nCONTEXT FROM WEBSITE:\n${context}\n\nUSER QUESTION: ${query}\n\nAnswer:`;

        if (streamCallback) {
          const response = await axios.post(
            "https://api.anthropic.com/v1/messages",
            {
              model: customModel,
              max_tokens: MAX_OUTPUT_TOKENS,
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
              // Previously this call had NO timeout at all.
              timeout: STREAM_TOTAL_TIMEOUT_MS,
            },
          );

          let fullAnswer = "";
          // SSE frames can be split across TCP packets, so we buffer any
          // trailing partial line and prepend it to the next packet. Without
          // this, `JSON.parse` fails on a truncated object and that span of
          // answer text is silently dropped — visible as missing words mid
          // sentence in the widget.
          let partialLine = "";

          await new Promise<void>((resolve, reject) => {
            response.data.on("data", (rawChunk: Buffer) => {
              const parts = (partialLine + rawChunk.toString()).split("\n");
              partialLine = parts.pop() ?? "";

              for (const line of parts) {
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
                    streamCallback?.(text);
                  }
                } catch {
                  // ignore malformed SSE lines
                }
              }
            });
            response.data.on("end", resolve);
            response.data.on("error", reject);
          });

          logger.info(`[LLM] Answer via Claude (stream) | model: ${customModel}`);
          return { answer: fullAnswer, thinking: "", sources, sourceDetails };
        } else {
          const response = await withTimeout(
            (signal) =>
              axios.post(
                "https://api.anthropic.com/v1/messages",
                {
                  model: customModel,
                  max_tokens: MAX_OUTPUT_TOKENS,
                  messages: [{ role: "user", content: fullPrompt }],
                },
                {
                  headers: {
                    "x-api-key": customApiKey,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                  },
                  signal,
                },
              ),
            GENERATION_TIMEOUT_MS,
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
        const chain = RunnableSequence.from([prompt, llm, new StringOutputParser()]);

        if (streamCallback) {
          const stream = await chain.stream(promptInput, {
            signal: AbortSignal.timeout(STREAM_TOTAL_TIMEOUT_MS),
          });
          const { fullAnswer } = await streamWithThinkingStripped(
            stream,
            streamCallback,
          );
          logger.info(
            `[LLM] Answer via custom model (stream) | model: ${customModel}`,
          );
          return { answer: fullAnswer, thinking: "", sources, sourceDetails };
        } else {
          const answer = await withTimeout(
            (signal) => chain.invoke(promptInput, { signal }),
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

  // ── Platform waterfall: Alibaba Qwen+ → Alibaba Qwen Flash → Groq ────────
  //
  // Each entry carries its own budget rather than sharing one value. The first
  // provider keeps the full allowance because that is where users spend their
  // wait time when it is healthy; by the last fallback the user has already
  // waited a long time, and a fast degraded answer beats a slow perfect one.
  //
  // Ordering rationale, from measured behaviour rather than preference:
  //
  //  1. qwen-plus-character — ~0.9 s, 15/15 sequential + 8/8 parallel calls
  //     clean, 8/8 on in-domain grounding AND 0/8 failures on absent-fact and
  //     off-topic probes. The only model tested that refuses to invent.
  //
  //  2. qwen-flash-character — same latency and reliability, but 4/8 failures
  //     when the answer is NOT in the corpus: it claimed "support all
  //     programming languages" and wrote a Python script when asked something
  //     off-topic. Safe as a middle tier, wrong as the only tier.
  //
  //  3. Groq — independent provider, so it survives an Alibaba-side outage.
  //
  //  4. Bedrock qwen.qwen3-32b — a second independent cloud, so it also
  //     survives a Groq-side rate limit. Measured 0/8 failures refusing
  //     absent facts and 5/5 on in-domain grounding with citations, at ~1.0 s.
  //     Placed last as insurance: Alibaba's quota expires 2027-01-08, and a
  //     second provider that cannot be rate-limited by Alibaba is worth
  //     having even if it is rarely reached.
  //
  // Gemini was removed: measured at 32-104 s per call on the platform key.
  const providers: Array<{
    name: string;
    circuitName: string;
    timeoutMs: number;
    getLLM: () =>
      | ReturnType<typeof getAlibabaLLM>
      | ReturnType<typeof getGroqLLM>
      | ReturnType<typeof getBedrockLLM>;
  }> = [
    {
      name: "Alibaba-qwen-plus",
      circuitName: "aliyun-plus",
      timeoutMs: GENERATION_TIMEOUT_MS,
      getLLM: () => getAlibabaLLM("qwen-plus-character", 0.2),
    },
    {
      name: "Alibaba-qwen-flash",
      circuitName: "aliyun-flash",
      timeoutMs: GENERATION_TIMEOUT_MS,
      getLLM: () => getAlibabaLLM("qwen-flash-character", 0.2),
    },
    {
      name: "Groq",
      circuitName: "groq",
      timeoutMs: FALLBACK_TIMEOUT_MS,
      getLLM: () => getGroqLLM(0.2),
    },
    {
      name: "Bedrock-qwen3-32b",
      circuitName: "bedrock",
      timeoutMs: FALLBACK_TIMEOUT_MS,
      getLLM: () => getBedrockLLM("qwen.qwen3-32b", 0.2),
    },
  ];

  const generationDeadline = Date.now() + TOTAL_GENERATION_BUDGET_MS;

  // If every provider's circuit is open, skip the breaker entirely for this
  // request and try the normal waterfall.
  //
  // Without this the breaker deadlocks: all entries skipped means nothing is
  // attempted means nothing can report success means the circuits never close.
  // Observed live — requests returned "I'm having trouble connecting to my AI
  // service" while a perfectly healthy fallback sat one attempt away. A
  // slightly slow answer always beats a confident error.
  const anyUsable = providers.some((p) => isProviderUsable(p.circuitName));
  if (!anyUsable) {
    logger.warn(
      "[LLM] All provider circuits are open — bypassing breaker for this request",
    );
  }

  for (const { name, circuitName, timeoutMs, getLLM } of providers) {
    const remaining = generationDeadline - Date.now();

    // Out of time: stop here rather than burning another provider's timeout.
    if (remaining <= 0) {
      logger.warn(
        `[LLM] Generation budget of ${TOTAL_GENERATION_BUDGET_MS}ms exhausted before reaching ${name}`,
      );
      break;
    }

    // Never give a provider more than what's left of the total budget.
    const effectiveTimeout = Math.min(timeoutMs, remaining);

    // Skip a provider that has been failing or timing out recently. Without
    // this, a provider that is slow rather than broken costs every single
    // request its full timeout before we fall through.
    if (anyUsable && !isProviderUsable(circuitName)) {
      logger.info(`[LLM] Skipping ${name} — circuit open after repeated failures`);
      continue;
    }

    try {
      const chain = RunnableSequence.from([
        prompt,
        getLLM(),
        new StringOutputParser(),
      ]);

      if (streamCallback) {
        // Time-to-first-token deadline.
        //
        // `AbortSignal.timeout()` cannot be cancelled, so it cannot express
        // "give up if the FIRST token is late" — it would also kill the stream
        // 6 s in even while tokens were flowing normally. Instead we drive a
        // controller ourselves and clear its timer the moment the first chunk
        // lands, after which only the total deadline applies.
        //
        // Why it matters: with a silent provider the widget shows an empty
        // bubble for the entire wait, and time-to-first-token is what the user
        // actually perceives.
        const startedStreamingAt = Date.now();
        let firstTokenAt: number | null = null;
        const firstTokenController = new AbortController();
        // Bound the first-token wait by whichever is smaller: the policy
        // threshold or what remains of the total generation budget.
        const firstTokenTimer = setTimeout(
          () => firstTokenController.abort(),
          Math.min(FIRST_TOKEN_TIMEOUT_MS, remaining),
        );
        let sawFirstToken = false;

        try {
          const stream = await chain.stream(promptInput, {
            signal: AbortSignal.any([
              AbortSignal.timeout(STREAM_TOTAL_TIMEOUT_MS),
              firstTokenController.signal,
            ]),
          });

          const { fullAnswer, thinking } = await streamWithThinkingStripped(
            stream,
            (text) => {
              if (!sawFirstToken) {
                sawFirstToken = true;
                firstTokenAt = Date.now();
                // First token landed — the provider is alive, so the
                // first-token deadline no longer applies.
                clearTimeout(firstTokenTimer);
              }
              streamCallback(text);
            },
          );
          // Judge on time-to-first-token: that is the latency the user waits,
          // not the total generation time of a long answer.
          recordProviderSuccess(
            circuitName,
            firstTokenAt !== null ? firstTokenAt - startedStreamingAt : undefined,
          );
          logger.info(`[LLM] Answer via ${name} (stream) | chunks: ${chunks.length}`);
          return { answer: fullAnswer, thinking, sources, sourceDetails };
        } finally {
          clearTimeout(firstTokenTimer);
        }
      } else {
        const startedAt = Date.now();
        const rawAnswer = await withTimeout(
          (signal) => chain.invoke(promptInput, { signal }),
          effectiveTimeout,
        );
        // Duration matters as much as the outcome: a "successful" call that
        // took 8 s is still a failure from the user's point of view.
        recordProviderSuccess(circuitName, Date.now() - startedAt);
        const { clean, thinking } = stripThinking(rawAnswer);
        logger.info(`[LLM] Answer via ${name} | chunks: ${chunks.length}`);
        return { answer: clean, thinking, sources, sourceDetails };
      }
    } catch (err: any) {
      recordProviderFailure(circuitName);
      logger.warn(`[LLM] ${name} failed (${err.message}) — trying next provider`);
    }
  }

  // All providers failed — return a graceful message instead of a 500
  logger.error("[LLM] All providers exhausted — returning fallback message");
  const fallbackAnswer =
    "I'm having trouble connecting to my AI service right now. Please try again in a moment.";
  if (streamCallback) streamCallback(fallbackAnswer);
  return { answer: fallbackAnswer, thinking: "", sources, sourceDetails };
}