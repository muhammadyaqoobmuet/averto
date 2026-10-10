-- ============================================================
-- Migration: retrieval performance indexes
-- ============================================================
-- Companion to the retrieval pipeline changes:
--   - dense search now runs over ALL query variants, not just the raw query
--   - HNSW search is tuned (ef_search, iterative_scan)
--   - the controller no longer runs COUNT(*) per request, which needs
--     "Chunk_chatbotId_idx" to stop being a sequential scan
--
-- ── Why these are NOT CONCURRENTLY ──────────────────────────────────────────
-- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, and
-- `prisma migrate deploy` wraps every migration file in one. Using it here
-- makes the migration fail outright on a fresh deploy.
--
-- Plain CREATE INDEX takes a brief exclusive lock while it builds. That is
-- correct and fast here because this migration runs during initial setup,
-- before the backend accepts traffic and while "Chunk" is empty.
--
-- If you need to add these indexes to a database that is ALREADY serving
-- traffic, run the non-locking variant instead:
--
--     psql "$DATABASE_URL" -f scripts/add-retrieval-indexes-concurrently.sql
--
-- That script is idempotent and can be run at any time.
-- ============================================================

-- ── 1. chatbotId index ──────────────────────────────────────────────────────
--
-- THE critical missing index. Every retrieval query filters on
--   WHERE c."chatbotId" = $1
-- (dense.service.ts and sparse.service.ts) but the column had no index at
-- all, so Postgres fell back to a sequential scan on every single chat
-- request. On a 700-chunk corpus this was a 65 ms hit per message, growing
-- with the corpus.
CREATE INDEX IF NOT EXISTS "Chunk_chatbotId_idx"
  ON "Chunk" ("chatbotId");

-- ── 2. Composite (chatbotId, pageId) ────────────────────────────────────────
--
-- Supports per-page chunk lookups and the delete-before-reinsert in
-- indexPageContent (`chunk.deleteMany({ where: { pageId } })`), which the
-- single-column index above cannot serve.
CREATE INDEX IF NOT EXISTS "Chunk_chatbotId_pageId_idx"
  ON "Chunk" ("chatbotId", "pageId");

-- ── 3. HNSW tuning ──────────────────────────────────────────────────────────
--
-- m: 16 → 24. Higher `m` means each node keeps more neighbours, which raises
-- recall at the cost of index size and build time. 24 is a good trade for a
-- corpus where a missed neighbour is a wrong answer.
--
-- ef_construction: 64 → 128. Higher build-time candidate list → better graph
-- quality. One-off cost at index build; queries are unaffected. Runtime
-- ef_search is set per query in dense.service.ts (100).
--
-- Postgres cannot change an existing index's parameters in place, so the new
-- index is created under a new name and the old one is dropped.
CREATE INDEX IF NOT EXISTS "Chunk_embedding_hnsw_idx_v2"
  ON "Chunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

DROP INDEX IF EXISTS "chunk_embedding_hnsw_idx";

-- ── 4. Statistics refresh ────────────────────────────────────────────────────
--
-- HNSW build parameters are read by the planner only when table statistics are
-- fresh. After bulk-loading a large crawl, stale stats can lead the planner to
-- underestimate the sequential path and skip the index entirely.
ANALYZE "Chunk";
