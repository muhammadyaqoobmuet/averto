import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { logger } from "../../utils/logger";

export interface SparseHit {
  id: string;
  content: string;
  heading: string | null;
  url: string;
  rank: number; // ts_rank_cd score from Postgres full-text ranking
}

type RawSparseRow = {
  id: string;
  content: string;
  heading: string | null;
  url: string | null;
  rank: number | string;
};

/**
 * BM25-style sparse retrieval using Postgres full-text search (tsvector / tsquery).
 *
 * Relies on the `content_tsv` generated column added by the
 * 20260614_add_tsvector migration.
 *
 * Uses `websearch_to_tsquery` which handles natural-language queries better
 * than `plainto_tsquery` — it supports quoted phrases, OR, and -exclusions
 * if the user types them.
 *
 * FAIL-OPEN: if `websearch_to_tsquery` produces an empty tsquery (e.g. the
 * query is only stopwords or punctuation) Postgres will error or return
 * nothing — we catch both cases and return [] rather than throwing.
 *
 * @param chatbotId  - Filter chunks to this chatbot only.
 * @param query      - Natural-language query string (one variant at a time).
 * @param limit      - Max hits to return (default 25).
 */
export async function sparseSearch(
  chatbotId: string,
  query: string,
  limit = 25,
): Promise<SparseHit[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const rows = await prisma.$queryRaw<RawSparseRow[]>(
      Prisma.sql`
        SELECT
          c.id,
          c.content,
          c.heading,
          p.url,
          ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', ${query})) AS rank
        FROM "Chunk" c
        JOIN "CrawlPage" p ON p.id = c."pageId"
        WHERE c."chatbotId" = ${chatbotId}
          AND c.content_tsv @@ websearch_to_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
      `,
    );

    logger.debug(`[Sparse] ${rows.length} hits for query "${query}"`);

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      heading: r.heading,
      url: r.url ?? "",
      rank: Number(r.rank),
    }));
  } catch (error: unknown) {
    const err = error as { message?: string };
    // Empty tsquery or GIN index not ready — return empty list instead of crashing
    logger.warn(
      `[Sparse] Full-text search returned no results or errored for query "${query}": ${err.message ?? "unknown"}`,
    );
    return [];
  }
}
