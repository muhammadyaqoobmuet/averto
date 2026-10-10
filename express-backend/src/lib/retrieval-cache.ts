import crypto from "crypto";
import { getRedis } from "./redis";
import { logger } from "../utils/logger";

/**
 * Retrieval result cache backed by Redis.
 *
 * ── Why cache at all? ────────────────────────────────────────────────────────
 * On a customer-support widget, a large share of questions are repeats or
 * near-repeats ("what are your plans?", "pricing?", "do you offer refunds?").
 * A full retrieval pass costs ~0.6-2.0 s and money (Voyage embed + rerank).
 * Serving a cached hit turns that into a single Redis GET (~1 ms).
 *
 * ── Why every operation degrades to a miss ──────────────────────────────────
 * `getRedis()` is lazy and Redis may be down, misconfigured, or absent in a
 * dev environment. A cache must never be able to take the chatbot offline, so
 * every method swallows connection errors and behaves as a permanent miss.
 *
 * ── What is NOT cached ──────────────────────────────────────────────────────
 * We cache only the *retrieval* stage (chunk ids + scores + content). The LLM
 * generation is NOT cached: answers vary with model, temperature and prompt
 * version, and a stale cached answer is a correctness bug, not just staleness.
 */
const loggerForCache = logger.child({ name: "retrieval-cache" });

/** How long a cached retrieval result stays valid. */
const RETRIEVAL_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Bumped whenever the retrieval pipeline changes in a way that invalidates
 * previously cached results (new chunking, new embedding model, new fusion).
 *
 * Today it is 2:
 *   1 = original dense+sparse+RRF+rerank pipeline
 *   2 = heading-aware chunking + multi-variant dense search + weighted RRF
 *
 * The version is part of the cache key, so an old entry is simply never read
 * again — no migration, no manual flush after a deploy.
 */
export const RETRIEVAL_CACHE_VERSION = 2;

/**
 * Normalises a user query into a stable cache key component.
 *
 * Without this, "Do you offer refunds?" and "  do you offer refunds  " would
 * be two cache entries. Lower-casing, collapsing whitespace and stripping
 * trailing punctuation catches the overwhelmingly common case of identical
 * questions typed with different casing or stray punctuation.
 *
 * This is deliberately conservative: it is not a fuzzy matcher. Near-duplicate
 * questions that differ in wording will miss the cache, which is safe (just a
 * slower request), whereas an over-eager match would serve the wrong answer.
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    // Collapse internal runs of whitespace first...
    .replace(/\s+/g, " ")
    // ...then trim, so the punctuation strip below actually reaches the end
    // of the string. Trimming afterwards left a trailing space after "refunds?"
    // and the `[?!.]+$` anchor never matched.
    .trim()
    .replace(/[?!.]+$/g, "")
    .trim()
    .slice(0, 300);
}

/**
 * Builds the Redis key for a retrieval result.
 * Shape: `rag:v{version}:{chatbotId}:{sha1(normalizedQuery)}`
 *
 * sha1 (not the raw query) keeps keys a fixed short length, which matters
 * because a long pasted paragraph would otherwise bloat the key and get
 * truncated oddly by some Redis proxies.
 */
export function retrievalCacheKey(
  chatbotId: string,
  query: string,
): string {
  const hash = crypto
    .createHash("sha1")
    .update(normalizeQuery(query))
    .digest("hex");
  return `rag:v${RETRIEVAL_CACHE_VERSION}:${chatbotId}:${hash}`;
}

/**
 * Redis connections can take a while to establish, and a blocking `await`
 * on a cold connection would add latency to the very first chat request.
 * This flag tracks whether we've ever had a working connection, so we only
 * bother issuing cache commands once the connection is actually usable.
 */
let redisUsable = false;

/**
 * Warms the connection and flips `redisUsable` on success.
 *
 * Called lazily on first use, and we intentionally do NOT await it from the
 * request path — fire and forget. If it hasn't resolved yet, we just skip
 * the cache for that request.
 */
function probeRedis(): void {
  if (redisUsable) return;
  try {
    const client = getRedis();
    // ioredis queues commands until connected, so awaiting PING is safe but
    // slow on a cold connection; that's why it's not on the critical path.
    client
      .ping()
      .then(() => {
        redisUsable = true;
      })
      .catch(() => {
        redisUsable = false;
      });
  } catch {
    redisUsable = false;
  }
}

/**
 * Reads a cached retrieval result.
 * Returns `null` on a miss, or on any Redis failure (fail-open).
 */
export async function getCachedRetrieval<T>(key: string): Promise<T | null> {
  probeRedis();
  if (!redisUsable) return null;

  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    loggerForCache.warn({ err, key }, "Retrieval cache GET failed — treating as miss");
    return null;
  }
}

/**
 * Writes a retrieval result to the cache.
 * Fire-and-forget: a failed SET must never delay or fail the request.
 */
export async function setCachedRetrieval(
  key: string,
  value: unknown,
  ttlSeconds: number = RETRIEVAL_CACHE_TTL_SECONDS,
): Promise<void> {
  probeRedis();
  if (!redisUsable) return;

  try {
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    loggerForCache.warn({ err, key }, "Retrieval cache SET failed — ignoring");
  }
}

/**
 * Invalidates every cached retrieval for one chatbot.
 *
 * Called after a re-crawl / document upload, because the chunks change and
 * any cached answer for that bot would point at deleted content.
 */
export async function invalidateChatbotCache(
  chatbotId: string,
): Promise<void> {
  probeRedis();
  if (!redisUsable) return;

  try {
    const redis = getRedis();
    const pattern = `rag:v${RETRIEVAL_CACHE_VERSION}:${chatbotId}:*`;
    const found: string[] = [];

    // SCAN rather than KEYS: KEYS blocks the whole Redis server for the
    // duration, which would stall BullMQ's queues on a busy instance.
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = next;
      found.push(...keys);
    } while (cursor !== "0");

    if (found.length > 0) {
      await redis.del(...found);
      loggerForCache.info(
        { chatbotId, count: found.length },
        "Invalidated retrieval cache for chatbot",
      );
    }
  } catch (err) {
    loggerForCache.warn(
      { err, chatbotId },
      "Cache invalidation failed — stale entries will expire via TTL",
    );
  }
}