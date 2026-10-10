/**
 * Tiny fixed-capacity LRU cache built on a Map.
 *
 * Why not a Map with manual pruning?
 *   JavaScript Maps preserve insertion order, so the oldest key is always the
 *   first one returned by `keys()`. That makes an LRU with no extra bookkeeping:
 *   on a hit we delete + re-insert to move the entry to the end (most recent),
 *   and on insert we evict from the front once we're over capacity.
 *
 * Used for hot, cheap-to-recompute values:
 *   - query embeddings (a Voyage round-trip is ~200-300 ms, and repeat
 *     questions are extremely common on a support widget)
 *   - per-chatbot chunk counts (a COUNT(*) on an unindexed column is slow)
 *
 * Deliberately in-process rather than Redis: these lookups happen on the hot
 * request path and must not pay a network round-trip. Distributed caching
 * lives in retrieval.service.ts via Redis, where the values are large enough
 * to be worth it.
 */
export class LruCache<V> {
  private readonly store = new Map<string, V>();

  /**
   * @param maxEntries - Hard cap. Once exceeded, the least-recently-used
   *                     entry is evicted on every insert.
   */
  constructor(private readonly maxEntries: number) {
    if (maxEntries <= 0) {
      throw new Error("LruCache maxEntries must be > 0");
    }
  }

  get size(): number {
    return this.store.size;
  }

  get(key: string): V | undefined {
    const value = this.store.get(key);
    if (value === undefined) return undefined;

    // Promote to most-recently-used.
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  set(key: string, value: V): void {
    // Re-inserting an existing key must evict it first, otherwise the old
    // position lingers in insertion order and we'd double-count it.
    if (this.store.has(key)) this.store.delete(key);

    this.store.set(key, value);

    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Drops every key starting with `prefix`.
   * Used to invalidate everything belonging to one chatbot after a re-crawl,
   * where any cached answer for that chatbot is now stale.
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}