import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Groq API key rotation.
 *
 * We have 3 Groq keys. Each call to getNextGroqKey() returns the next
 * key in round-robin order so we spread requests across all 3 keys,
 * lowering the chance of hitting any single key's rate limit.
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
 * Returns a Groq-backed LLM using the OpenAI-compatible Groq endpoint.
 * Uses `llama-3.3-70b-versatile` — fast and high quality for chat/RAG.
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
    modelName: "qwen/qwen3.6-27b",
    temperature,
    maxRetries: 0, // Handled externally via fallback chain
    configuration: {
      baseURL: "https://api.groq.com/openai/v1",
    },
  });
}

/**
 * Returns a Groq LLM tuned for fast, lightweight tasks (e.g. query expansion).
 * llama3-8b-8192 is tiny and ultra-fast — perfect for one-line JSON outputs.
 */
export function getGroqFastLLM(temperature = 0.1): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: getNextGroqKey(),
    modelName: "qwen/qwen3.6-27b",
    temperature,
    maxRetries: 0,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1",
    },
  });
}

/**
 * Returns the Google Gemini LLM.
 * Used as primary provider; if it times out or rate-limits,
 * callers should fall back to getGroqLLM().
 */
export function getGeminiLLM(temperature = 0.2): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature,
    apiKey: process.env.GEMINI_API_KEY,
    maxRetries: 0, // We handle fallback manually
  });
}

/**
 * Returns a LangChain-compatible LLM for a user-supplied custom model and API key.
 *
 * Routing rules:
 *   gpt-*    → OpenAI (api.openai.com)
 *   gemini-* → Google Generative AI
 *   llama* / mixtral* → Groq (via OpenAI-compatible endpoint)
 *
 * Claude models are NOT handled here; use the Anthropic axios path in llm.service.ts.
 */
export function getCustomLLM(model: string, apiKey: string): BaseChatModel {
  if (model.startsWith("gpt-")) {
    return new ChatOpenAI({
      apiKey,
      modelName: model,
      temperature: 0.2,
      maxRetries: 0,
      configuration: {
        baseURL: "https://api.openai.com/v1",
      },
    });
  }

  if (model.startsWith("gemini-")) {
    return new ChatGoogleGenerativeAI({
      model,
      temperature: 0.2,
      apiKey,
      maxRetries: 0,
    });
  }

  if (model.startsWith("llama") || model.startsWith("mixtral")) {
    return new ChatOpenAI({
      apiKey,
      modelName: model,
      temperature: 0.2,
      maxRetries: 0,
      configuration: {
        baseURL: "https://api.groq.com/openai/v1",
      },
    });
  }

  throw new Error(
    `Unsupported custom model prefix: "${model}". ` +
      "Supported prefixes: gpt-, gemini-, llama, mixtral. " +
      "For Claude models use the Anthropic axios path.",
  );
}
