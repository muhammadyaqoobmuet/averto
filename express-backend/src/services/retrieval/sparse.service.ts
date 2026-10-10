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
 * The text-search configuration used for BOTH the stored `content_tsv` column
 * and the query tsquery.
 *
 * ── Why 'simple' and not 'english' ─────────────────────────────────────────
 * The column is defined in the migration as:
 *   to_tsvector('english', coalesce(content,'') || ' ' || coalesce(heading,''))
 *
 * Switching the query side to 'simple' WITHOUT rebuilding the column would
 * guarantee zero matches — the stemmed index and an unstemmed tsquery share
 * no lexeme keys. The two must agree, so this constant documents the contract:
 * any change here requires a migration that rebuilds `content_tsv` with the
 * matching configuration.
 *
 * 'english' stems and drops English stopwords. That is correct for prose and
 * wrong for a product knowledge base: "pricing" becomes "pric" (fine), but
 * "SaaS", "API", "SAML", "OAuth" and version strings like "v2.0" are mangled
 * or dropped entirely, which silently removes exactly the queries a technical
 * audience types.
 *
 * Given this product indexes customer websites (services, pricing, contact,
 * docs), 'english' is the safer default: it handles the stopword-heavy natural
 * language people actually type into a support widget. The column is rebuilt
 * by migration 20260616_... in this same change if you decide to switch.
 */
const TEXT_SEARCH_CONFIG = "english";

/**
 * BM25-style sparse retrieval using Postgres full-text search (tsvector/tsquery).
 *
 * Relies on the `content_tsv` generated column added by the
 * 20260614_add_tsvector migration.
 *
 * Uses `websearch_to_tsquery` which handles natural-language queries better
 * than `plainto_tsquery` — it supports quoted phrases, OR, and -exclusions
 * if the user types them.
 *
 * FAIL-OPEN: if the query produces an empty tsquery (stopwords only, or pure
 * punctuation) Postgres raises "syntax error in tsquery". We catch that and
 * return `[]` rather than propagating — the dense channel and the LLM can
 * still answer.
 *
 * @param chatbotId - Filter chunks to this chatbot only.
 * @param query     - Natural-language query string (one variant at a time).
 * @param limit     - Max hits to return.
 */
export async function sparseSearch(
  chatbotId: string,
  query: string,
  limit = 25,
): Promise<SparseHit[]> {
  if (!query || query.trim().length === 0) return [];

  const t0 = Date.now();

  try {
    // The `::regconfig` cast is required, not stylistic. When the config name
    // is sent as a bind parameter Postgres cannot infer its type and reports
    // `function websearch_to_tsquery(text, text) does not exist`, because
    // there is no implicit text→regconfig coercion. The cast tells the planner
    // exactly which function to bind. `::text` on the query does the same for
    // the second argument.
    const rows = await prisma.$queryRaw<RawSparseRow[]>(
      Prisma.sql`
        SELECT
          c.id,
          c.content,
          c.heading,
          p.url,
          ts_rank_cd(c.content_tsv, websearch_to_tsquery(${TEXT_SEARCH_CONFIG}::regconfig, ${query}::text)) AS rank
        FROM "Chunk" c
        JOIN "CrawlPage" p ON p.id = c."pageId"
        WHERE c."chatbotId" = ${chatbotId}
          AND c.content_tsv @@ websearch_to_tsquery(${TEXT_SEARCH_CONFIG}::regconfig, ${query}::text)
        ORDER BY rank DESC
        LIMIT ${limit}
      `,
    );

    logger.debug(
      `[Sparse] ${rows.length} hits in ${Date.now() - t0}ms for query "${query}"`,
    );

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
    logger.debug(
      `[Sparse] Full-text search returned no results or errored for query "${query}": ${err.message ?? "unknown"}`,
    );
    return [];
  }
}