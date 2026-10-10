-- ============================================================
-- Migration: retrieval performance indexes + cache versioning
-- ============================================================
-- Companion to the retrieval pipeline changes:
--   - dense search now runs over ALL query variants, not just the raw query
--   - HNSW search is tuned (ef_search, iterative_scan)
--   - the controller no longer runs COUNT(*) per request (see chunk_chatbot_id_idx)
--
-- All indexes use CONCURRENTLY so this does not lock writes on a live table.
-- CONCURRENTLY cannot run inside a transaction block, and Prisma wraps each
-- migration file in one — so run this file manually:
--
--   npx prisma migrate resolve --rolled-back 20260616_retrieval_perf || true
--   psql "$DATABASE_URL" -f prisma/migrations/20260616_retrieval_perf/migration.sql
--
-- ============================================================

-- ── 1. chatbotId index ──────────────────────────────────────────────────────
--
-- THE critical missing index. Every retrieval query filters on
--   WHERE c."chatbotId" = $1
-- (dense.service.ts and sparse.service.ts) but the column had no index at
-- all, so Postgres fell back to a sequential scan on every single chat
-- request.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Chunk_chatbotId_idx"
  ON "Chunk" ("chatbotId");

-- ── 2. Composite (chatbotId, pageId) ────────────────────────────────────────
--
-- Supports per-page chunk lookups and the delete-before-reinsert in
-- indexPageContent (`chunk.deleteMany({ where: { pageId } })`), which the
-- single-column index above cannot serve.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Chunk_chatbotId_pageId_idx"
  ON "Chunk" ("chatbotId", "pageId");

-- ── 3. HNSW tuning ──────────────────────────────────────────────────────────
--
-- m: 16 → 24. Higher `m` means each node keeps more neighbours, which raises
-- recall at the cost of index size and build time. 24 is a good trade for a
-- corpus where a missed neighbour is a wrong answer.
--
-- ef_construction: 64 → 128. Higher build-time candidate list → better graph
-- quality. This is a one-off cost at index build; queries are unaffected.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Chunk_embedding_hnsw_idx_v2"
  ON "Chunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

-- Drop the older, lower-quality index now that the replacement exists.
-- Both are named differently above because Postgres cannot swap an index's
-- parameters in place, and CONCURRENTLY DROP avoids an exclusive lock.
DROP INDEX CONCURRENTLY IF EXISTS "chunk_embedding_hnsw_idx";

-- ── 4. Statistic refresh ────────────────────────────────────────────────────
--
-- HNSW build parameters (`ef_search`, `ef_construction`) are read by the
-- planner only when statistics for the table are fresh. After bulk-loading a
-- large crawl, stale stats can lead the planner to underestimate the cost of
-- the sequential path and skip the index entirely.
ANALYZE "Chunk";