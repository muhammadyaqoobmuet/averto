import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { logger } from "../../utils/logger";

export interface DenseHit {
  id: string;
  content: string;
  heading: string | null;
  url: string;
  /** Cosine similarity, 1.0 = identical direction, 0 = orthogonal. */
  similarity: number;
}

// ── HNSW search tuning ───────────────────────────────────────────────────────
//
// pgvector's HNSW index is a GLOBAL index: the graph is built across every row
// in `Chunk` and the `chatbotId` filter is applied to whatever the walk
// returns. With one large tenant that's efficient; with many tenants the walk
// keeps landing on other customers' chunks and throwing them away, and recall
// drops silently.
//
// `ef_search` is the candidate-list size used during the graph walk. pgvector
// defaults to 40. Raising it costs a bit more work but recovers candidates a
// small list would have missed — a good trade for answer quality.
//
// `iterative_scan` (pgvector >= 0.8.0) lets the index keep expanding until it
// finds enough rows that actually match the filter, which specifically
// addresses the multi-tenant recall loss above.
const HNSW_EF_SEARCH = 100;

// ── iterative_scan capability probe ──────────────────────────────────────────
//
// `SET LOCAL hnsw.iterative_scan` is only valid on pgvector >= 0.8.0. On an
// older server it raises, and because that statement shares a transaction with
// the search itself, the failure would take down the whole query.
//
// We probe the extension VERSION rather than querying `pg_settings`. pgvector
// registers its GUCs from `_PG_init`, which only runs once a `vector` value is
// actually touched in the session — so a bare `SELECT ... FROM pg_settings`
// returns zero hnsw rows even on 0.8.x, and would silently disable this
// feature forever. The version is a plain, always-available fact.
const MIN_ITERATIVE_SCAN_VERSION = "0.8.0";

let iterativeScanSupported: boolean | null = null;

function versionAtLeast(actual: string, required: string): boolean {
  const parse = (v: string) =>
    v
      .split(".")
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n));
  const a = parse(actual);
  const b = parse(required);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av > bv;
  }
  return true;
}

async function supportsIterativeScan(): Promise<boolean> {
  if (iterativeScanSupported !== null) return iterativeScanSupported;

  try {
    const rows = await prisma.$queryRaw<Array<{ extversion: string }>>(
      Prisma.sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`,
    );
    const version = rows[0]?.extversion ?? "0.0.0";
    iterativeScanSupported = versionAtLeast(version, MIN_ITERATIVE_SCAN_VERSION);
    logger.info(
      `[Dense] pgvector ${version} — iterative_scan ${iterativeScanSupported ? "enabled" : "unavailable (needs >= 0.8.0)"}`,
    );
  } catch (err: any) {
    iterativeScanSupported = false;
    logger.warn(
      `[Dense] Could not determine pgvector version, disabling iterative_scan: ${err.message}`,
    );
  }

  return iterativeScanSupported;
}

// Query strings outside this token range skip LLM query expansion: very short
// queries are already well-covered by the lexical index, and very long ones
// are already specific — paraphrasing them risks dropping the constraints.
const EXPANSION_MIN_TOKENS = 3;
const EXPANSION_MAX_TOKENS = 12;

/**
 * Decides whether a query is worth running LLM query-expansion on.
 *
 * Short queries ("pricing?") benefit enormously — the LLM fills in the implied
 * domain words. Long ones ("what happens to my existing sessions if I change
 * the retention policy to 30 days while a job is mid-flight") are already
 * precise, and paraphrasing tends to lose detail.
 */
export function shouldExpandQuery(query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  return (
    tokens.length >= EXPANSION_MIN_TOKENS && tokens.length <= EXPANSION_MAX_TOKENS
  );
}

/**
 * Converts a JS number[] to the '[v1,v2,...]' text form pgvector's input
 * function expects.
 *
 * Prisma serialises a JS array as a PostgreSQL array literal '{v1,v2,...}',
 * which does NOT cast to `vector` — hence the manual formatting.
 */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * Dense vector similarity search over one pre-computed query embedding.
 *
 * The vector is passed in already-embedded rather than embedded here, because
 * `retrieveContext` batches every query variant into a single Voyage call.
 * Embedding inside this function would have cost one round-trip per variant.
 *
 * Fail-open: any error logs and returns `[]`, so sparse retrieval — and hence
 * the whole pipeline — still returns results.
 *
 * @param vector - Pre-computed 1024-dim query embedding.
 * @param limit  - Max hits to return.
 */
export async function denseSearchWithVector(
  chatbotId: string,
  vector: number[],
  limit = 25,
): Promise<DenseHit[]> {
  const t0 = Date.now();

  if (!Array.isArray(vector) || vector.length !== 1024) {
    logger.error(
      `[Dense] Refusing to search with a ${vector?.length ?? 0}-dim vector — expected 1024`,
    );
    return [];
  }

  const vectorStr = toVectorLiteral(vector);

  try {
    const iterativeScan = await supportsIterativeScan();

    const results = await prisma.$transaction(async (tx) => {
      // Each SET runs as its OWN statement. Prisma's raw queries use the
      // extended (prepared-statement) protocol, which permits exactly one
      // command per statement — sending `SET ...; SET ...;` together fails
      // with "cannot insert multiple commands into a prepared statement".
      //
      // `SET LOCAL` is transaction-scoped, so both settings apply to the
      // search below and evaporate at COMMIT — they never leak onto another
      // request that reuses this pooled connection.
      //
      // The value is inlined because Postgres' SET grammar takes a literal,
      // not a bind parameter (`SET LOCAL x = $1` is a syntax error). Safe
      // only because HNSW_EF_SEARCH is a module-level integer constant, so no
      // caller-supplied data can reach this string. Keep it that way.
      await tx.$executeRaw(
        Prisma.sql`SET LOCAL hnsw.ef_search = ${Prisma.raw(String(HNSW_EF_SEARCH))}`,
      );

      if (iterativeScan) {
        await tx.$executeRaw(Prisma.sql`SET LOCAL hnsw.iterative_scan = 'strict_order'`);
      }

      return tx.$queryRaw<
        Array<{
          id: string;
          content: string;
          heading: string | null;
          url: string | null;
          similarity: number | string;
        }>
      >(Prisma.sql`
        SELECT
            c.id,
            c.content,
            c.heading,
            p.url,
            (1 - (c.embedding <=> ${vectorStr}::vector)) AS similarity
        FROM "Chunk" c
        JOIN "CrawlPage" p ON p.id = c."pageId"
        WHERE c."chatbotId" = ${chatbotId}
        ORDER BY c.embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      `);
    });

    logger.debug(
      `[Dense] Search took ${Date.now() - t0}ms | ${results.length} hits`,
    );

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      heading: r.heading,
      url: r.url ?? "",
      similarity: Number(r.similarity),
    }));
  } catch (err: any) {
    logger.error(`[Dense] Search failed: ${err.message}`);
    return [];
  }
}

/**
 * Runs dense search across several query variants and merges the results.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Query expansion produces 2-3 phrasings, but the original pipeline fed ONLY
 * the raw query to dense search — the variants were used for sparse retrieval
 * alone. That discarded most of the benefit of expansion on the semantic
 * channel, which is normally the stronger of the two.
 *
 * Each variant gets its own ANN query, then the lists are merged by local RRF.
 *
 * @param vectors - One embedding per query variant, in the same order.
 */
export async function denseSearchMultiVariant(
  chatbotId: string,
  vectors: number[][],
  limitPerVariant = 25,
): Promise<DenseHit[]> {
  if (vectors.length === 0) return [];

  if (vectors.length === 1) {
    return denseSearchWithVector(chatbotId, vectors[0], limitPerVariant);
  }

  const lists = await Promise.all(
    vectors.map((v) =>
      denseSearchWithVector(chatbotId, v, limitPerVariant).catch(
        () => [] as DenseHit[],
      ),
    ),
  );

  return mergeDenseHits(lists);
}

/**
 * Merges several dense result lists into one ranking.
 *
 * Uses Reciprocal Rank Fusion locally: a chunk's score is the sum of
 * 1/(k + rank) across every list it appears in. This rewards a chunk that is
 * consistently good across phrasings over one that is #1 for a single phrasing
 * and absent from all the others.
 */
export function mergeDenseHits(lists: DenseHit[][]): DenseHit[] {
  const k = 60; // RRF constant from the original Cormack et al. paper.
  const scores = new Map<string, number>();
  const byId = new Map<string, DenseHit>();

  for (const list of lists) {
    list.forEach((hit, index) => {
      scores.set(hit.id, (scores.get(hit.id) ?? 0) + 1 / (k + index + 1));
      if (!byId.has(hit.id)) byId.set(hit.id, hit);
    });
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id)!)
    .filter(Boolean);
}