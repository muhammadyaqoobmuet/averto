-- ============================================================================
-- Add the retrieval performance indexes WITHOUT locking writes.
-- ============================================================================
-- Run this instead of prisma/migrations/20260616_retrieval_perf when the
-- database is ALREADY serving traffic. The migration file uses plain
-- CREATE INDEX so that `prisma migrate deploy` works on a fresh setup; this
-- variant is the non-blocking equivalent for a live system.
--
-- Usage:
--     psql "$DATABASE_URL" -f scripts/add-retrieval-indexes-concurrently.sql
--
-- Safe to run more than once — every statement is IF EXISTS / IF NOT EXISTS.
--
-- NOTE: CONCURRENTLY cannot run inside a transaction block. Do NOT wrap this
-- in BEGIN/COMMIT, and do not use `psql --single-transaction`. Each statement
-- below runs on its own.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Chunk_chatbotId_idx"
  ON "Chunk" ("chatbotId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Chunk_chatbotId_pageId_idx"
  ON "Chunk" ("chatbotId", "pageId");

-- Built under a new name because Postgres cannot change an index's parameters
-- in place; the old index is dropped only once the replacement exists.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Chunk_embedding_hnsw_idx_v2"
  ON "Chunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

DROP INDEX CONCURRENTLY IF EXISTS "chunk_embedding_hnsw_idx";

ANALYZE "Chunk";
