import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Uniform output cap for every platform provider.
 *
 * Previously only the Anthropic path set a token cap — Gemini and Groq were
 * uncapped, so identical questions could produce a 50-word reply or a
 * 1,500-word one depending purely on which provider answered. This is a
 * website-support chatbot; answers should be short and scannable.
 */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Groq API key rotation.
 *
 * We have 3 Groq keys. Each call to getNextGroqKey() returns the next key in
 * round-robin order so we spread requests across all of them, lowering the
 * chance of hitting any single key's rate limit.
 *
 * Keys come from env vars GROQ_API_KEY_1/2/3.
 */
const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter((k): k is string => !!k && k.length > 0);

let groqKeyIndex = 0;

function getNextGroqKey(): string {
  if (GROQ_KEYS.length === 0) {
    throw new Error("No Groq API keys configured (GROQ_API_KEY_1/2/3)");
  }
  const key = GROQ_KEYS[groqKeyIndex];
  groqKeyIndex = (groqKeyIndex + 1) % GROQ_KEYS.length;
  return key;
}

/**
 * Base URL for Groq's OpenAI-compatible endpoint.
 *
 * Resolved through one helper so every Groq-backed model honours the same
 * override. Previously only `getGroqFastLLM` read `GROQ_BASE_URL` while
 * `getGroqLLM` hard-coded the public URL — meaning behind a proxy or a
 * self-hosted gateway, query expansion and answer generation could end up
 * hitting two entirely different servers.
 */
function getGroqBaseUrl(): string {
  return process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
}

/**
 * Returns a Groq-backed LLM using the OpenAI-compatible Groq endpoint.
 *
 * Why ChatOpenAI instead of a Groq-specific class?
 * Groq exposes an OpenAI-compatible REST API, so @langchain/openai works
 * perfectly here without any extra packages.
 *
 * Each call rotates to the next API key automatically.
 */
export function getGroqLLM(temperature = 0.2): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: getNextGroqKey(),
    modelName: "qwen/qwen3.8-27b",
    temperature,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 0, // Handled externally via fallback chain
    configuration: {
      baseURL: getGroqBaseUrl(),
    },
  });
}

/**
 * Returns a Groq LLM tuned for fast, lightweight tasks (e.g. query expansion).
 * The intent is a small, ultra-fast model for one-line JSON outputs — the
 * answer must be short or it eats into the retrieval latency budget.
 */
export function getGroqFastLLM(temperature = 0.1): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: getNextGroqKey(),
    modelName: "qwen/qwen3.8-27b",
    temperature,
    maxTokens: 512, // Expansion only ever emits a short JSON array
    maxRetries: 0,
    configuration: {
      baseURL: getGroqBaseUrl(),
    },
  });
}

// NOTE: there is deliberately no platform-level Gemini provider any more.
// Measured against the platform key, `gemini-3.8-flash` took 32-104 s to
// answer even a one-line question, and every request in the waterfall paid
// that before falling through. The BYOK `gemini-*` branch below is unrelated
// and remains: a customer may still choose Gemini with their own key.

/**
 * Returns a LangChain-compatible LLM for a user-supplied custom model and API key.
 *
 * Routing rules:
 *   gpt-*    → OpenAI (api.openai.com)
 *   gemini-* → Google Generative AI
 *   llama* / mixtral* → Groq (via OpenAI-compatible endpoint)
 *   qwen-*   → Alibaba Model Studio (OpenAI-compatible endpoint)
 *
 * Claude models are NOT handled here; use the Anthropic axios path in llm.service.ts.
 */
export function getCustomLLM(model: string, apiKey: string): BaseChatModel {
  if (model.startsWith("gpt-")) {
    return new ChatOpenAI({
      apiKey,
      modelName: model,
      temperature: 0.2,
      maxTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      },
    });
  }

  if (model.startsWith("gemini-")) {
    return new ChatGoogleGenerativeAI({
      model,
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      apiKey,
      maxRetries: 0,
    });
  }

  if (model.startsWith("llama") || model.startsWith("mixtral")) {
    return new ChatOpenAI({
      apiKey,
      modelName: model,
      temperature: 0.2,
      maxTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      configuration: {
        baseURL: getGroqBaseUrl(),
      },
    });
  }

  if (model.startsWith("qwen")) {
    // Qwen on Alibaba Model Studio. The caller's key determines the region:
    // an `sk-ws-` international key must use the intl base URL, so we reuse
    // the same resolver the platform providers use.
    return new ChatOpenAI({
      apiKey,
      modelName: model,
      temperature: 0.2,
      maxTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      configuration: { baseURL: getAlibabaBaseUrl() },
    });
  }

  throw new Error(
    `Unsupported custom model prefix: "${model}". ` +
      "Supported prefixes: gpt-, gemini-, llama, mixtral, qwen. " +
      "For Claude models use the Anthropic axios path.",
  );
}
// ── Alibaba Cloud Model Studio (DashScope) ───────────────────────────────────

/**
 * Base URL for Model Studio's OpenAI-compatible endpoint.
 *
 * ── `dashscope-intl` is not interchangeable with `dashscope` ────────────────
 * Model Studio runs separate regional deployments. A key beginning `sk-ws-`
 * belongs to an international workspace and is REJECTED outright by the
 * Beijing endpoint (`invalid_api_key`); conversely a mainland key will not
 * authenticate here. Verified directly against both hosts.
 *
 * The env var exists so a mainland-China deployment can override this without
 * a code change.
 */
function getAlibabaBaseUrl(): string {
  return (
    process.env.ALIBABA_BASE_URL ||
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  );
}

/**
 * Returns the Alibaba API key.
 *
 * Read lazily rather than at module load: env loading order differs between
 * `app.ts` (dotenv at import time) and standalone scripts, and a key captured
 * as `undefined` at import time would stay undefined forever.
 */
function getAlibabaKey(): string {
  const key = process.env.ALIBABA_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!key) {
    throw new Error(
      "No Alibaba API key configured (ALIBABA_API_KEY or DASHSCOPE_API_KEY)",
    );
  }
  return key;
}

/**
 * Returns a Qwen model hosted on Alibaba Model Studio.
 *
 * Uses `ChatOpenAI` because Model Studio exposes an OpenAI-compatible REST
 * API — streaming, `max_tokens` and the SSE frame format were all verified to
 * match, so no custom client is needed.
 *
 * @param modelId - e.g. "qwen-plus-character" or "qwen-flash-character".
 */
export function getAlibabaLLM(
  modelId: string,
  temperature = 0.2,
): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: getAlibabaKey(),
    modelName: modelId,
    temperature,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 0, // The waterfall and circuit breaker handle retries.
    configuration: {
      baseURL: getAlibabaBaseUrl(),
    },
  });
}

/** Fast Qwen on Alibaba — used for short auxiliary tasks. */
export function getAlibabaFastLLM(temperature = 0.1): ChatOpenAI {
  return getAlibabaLLM("qwen-flash-character", temperature);
}

// ── AWS Bedrock (via the OpenAI-compatible gateway) ─────────────────────────

/**
 * Base URL for the Bedrock OpenAI-compatible gateway.
 *
 * This is a gateway, not the native Bedrock API. Real Bedrock
 * (`bedrock-runtime.<region>.amazonaws.com`) authenticates with SigV4 request
 * signing, whereas this endpoint accepts a static bearer token — so the two
 * are not interchangeable and the region in the hostname is part of the
 * credential's scope.
 */
function getBedrockBaseUrl(): string {
  return (
    process.env.BEDROCK_BASE_URL ||
    "https://bedrock-mantle.eu-north-1.api.aws/v1"
  );
}

function getBedrockKey(): string {
  const key =
    process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.BEDROCK_API_KEY;
  if (!key) {
    throw new Error(
      "No Bedrock bearer token configured (AWS_BEARER_TOKEN_BEDROCK or BEDROCK_API_KEY)",
    );
  }
  return key;
}

/**
 * Returns a Bedrock-hosted model through the OpenAI-compatible gateway.
 *
 * `OpenAI-Project: default` is a REQUIRED header on this gateway — omitting it
 * fails auth. It is sent via `defaultHeaders` rather than folded into the
 * apiKey because it is routing information, not a credential.
 *
 * Note: only some Bedrock models are reachable here. Anthropic models reject
 * `/v1/chat/completions` outright with
 * "does not support the '/v1/chat/completions' API" — they need the native
 * `/v1/messages` endpoint, which this codebase does not call. The OpenAI-
 * compatible path works for the Qwen, GLM, DeepSeek and gpt-oss families.
 */
export function getBedrockLLM(
  modelId: string,
  temperature = 0.2,
): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: getBedrockKey(),
    modelName: modelId,
    temperature,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 0, // The waterfall and circuit breaker handle retries.
    configuration: {
      baseURL: getBedrockBaseUrl(),
      defaultHeaders: { "OpenAI-Project": "default" },
    },
  });
}
