-- ============================================================
-- Migration: Add BM25-style full-text search column + indexes
-- ============================================================
-- Reason raw SQL is needed: Prisma schema.prisma has no native
-- support for GENERATED ALWAYS AS ... STORED computed columns,
-- so we must manage this column outside of Prisma migrations.
-- The column will never appear in schema.prisma; it is referenced
-- only via prisma.$queryRaw in sparse.service.ts.
-- ============================================================

-- 1. Add the generated tsvector column (computed from content + heading)
ALTER TABLE "Chunk"
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(content, '') || ' ' || coalesce(heading, ''))
    ) STORED;

-- 2. GIN index for fast full-text search (@@ operator)
CREATE INDEX IF NOT EXISTS chunk_content_tsv_idx
  ON "Chunk" USING GIN (content_tsv);

-- 3. HNSW (cosine) index for fast pgvector approximate nearest-neighbour search.
--    Prisma's @db.* annotations don't support HNSW, so we add it here.
--    If you already have an ivfflat index, you can skip/drop this.
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
  ON "Chunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
