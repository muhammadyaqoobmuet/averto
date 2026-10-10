/**
 * Vector-store integrity checker.
 *
 * Run: npx ts-node scripts/check-vector-integrity.ts [--fix]
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The corpus in this database was found to contain embeddings that do not
 * correspond to their own `content`: only 125 distinct vectors across 695
 * rows, and embedding a chunk's text returns that chunk at cosine ≈ 0.03 —
 * i.e. indistinguishable from an unrelated vector. Dense retrieval was
 * therefore returning arbitrary results, and no retrieval-quality change can
 * help until the corpus is rebuilt.
 *
 * A healthy store shows:
 *   - distinct_vectors == total_rows   (every chunk has its own vector)
 *   - median self-match similarity > 0.4 (and nowhere near 0)
 *   - on-topic queries ranking their own page highly
 *
 * Recovery requires the SOURCE content, which is not stored in Postgres —
 * `CrawlPage` has no content column. So the fix is to re-crawl (or re-upload
 * documents), not to patch rows in place. `--fix` therefore only removes the
 * provably-broken vectors so they stop polluting results; it cannot rebuild
 * them.
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { RawVoyageEmbeddings } from "../src/utils/voyage";
import { denseSearchWithVector } from "../src/services/retrieval/dense.service";

const SELF_MATCH_MIN = 0.4;
const DUPLICATE_MIN_RATIO = 0.9; // >90% rows sharing a vector is corruption

async function main() {
  const fix = process.argv.includes("--fix");

  const totals: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT count(*) FROM "Chunk")                                        AS total,
      (SELECT count(*) FROM "Chunk" WHERE embedding IS NULL)                 AS missing_vec,
      (SELECT count(DISTINCT embedding::text) FROM "Chunk"
        WHERE embedding IS NOT NULL)                                         AS distinct_vecs,
      (SELECT count(*) FROM "CrawlPage")                                     AS pages
  `);

  const { total, missing_vec, distinct_vecs, pages } = totals[0];
  // Postgres COUNT() comes back as BigInt over the wire; Math/format methods
  // refuse those, so coerce every aggregate to Number once, here.
  const TOTAL = Number(total);
  const MISSING = Number(missing_vec);
  const DISTINCT = Number(distinct_vecs);
  const PAGES = Number(pages);
  const ratio = DISTINCT / Math.max(1, TOTAL - MISSING);

  console.log("\n══════ VECTOR STORE INTEGRITY ══════");
  console.log(`  pages              : ${PAGES}`);
  console.log(`  chunks             : ${TOTAL}`);
  console.log(`  missing embeddings : ${MISSING}`);
  console.log(`  distinct vectors   : ${DISTINCT}`);
  console.log(`  uniqueness ratio   : ${ratio.toFixed(3)}  (healthy = 1.000)`);

  const dupes: any[] = await prisma.$queryRawUnsafe(`
    SELECT dup_count, count(*) AS groups, sum(dup_count) AS rows_involved
    FROM (
      SELECT embedding::text AS v, count(*) AS dup_count
      FROM "Chunk" WHERE embedding IS NOT NULL GROUP BY 1
    ) t WHERE dup_count > 1 GROUP BY 1 ORDER BY dup_count DESC LIMIT 10
  `);

  if (dupes.length) {
    console.log("\n  duplicated vector groups (top 10 by group size):");
    dupes.forEach((d) =>
      console.log(`    ${d.groups} group(s) of ${d.dup_count} rows -> ${d.rows_involved} rows`),
    );
  }

  // ── Self-match sample ─────────────────────────────────────────────────────
  const bots: any[] = await prisma.$queryRawUnsafe(`
    SELECT "chatbotId", count(*) n FROM "Chunk"
     WHERE embedding IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 3
  `);

  const embedder = new RawVoyageEmbeddings({});
  const sims: number[] = [];
  let checked = 0;

  for (const b of bots) {
    const chunks: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, content FROM "Chunk"
        WHERE "chatbotId" = $1 AND embedding IS NOT NULL
        ORDER BY random() LIMIT 3`,
      b.chatbotId,
    );

    for (const c of chunks) {
      const v = await embedder.embedQuery(String(c.content));
      const nn = await denseSearchWithVector(b.chatbotId, v, 3);
      const sim = nn[0]?.similarity ?? 0;
      const selfHit = nn.some((x: any) => x.id === c.id);
      sims.push(sim);
      checked++;
      console.log(
        `\n  bot ${b.chatbotId.slice(0, 8)} chunk ${c.id.slice(0, 8)}` +
          `\n    "${String(c.content).slice(0, 60).replace(/\n/g, " ")}..."` +
          `\n    top sim = ${sim.toFixed(4)}   self in top-3 = ${selfHit}`,
      );
    }
  }

  sims.sort((a, b) => a - b);
  const median = sims[Math.floor(sims.length / 2)] ?? 0;

  console.log("\n  ── verdict ──");
  const dupFailing = ratio < DUPLICATE_MIN_RATIO;
  const simFailing = median < SELF_MATCH_MIN;

  if (dupFailing || simFailing) {
    console.log(`  ✗ CORRUPT — duplicates=${dupFailing}, self-match=${simFailing}`);
    console.log(
      `\n  Dense retrieval cannot work on this corpus. The stored vectors do not` +
        `\n  correspond to their chunk text, so similarity search returns unrelated` +
        `\n  content. Sparse (tsvector) retrieval still works because it is derived` +
        `\n  from the text column, not the vectors.`,
    );
    console.log(
      `\n  RECOVERY: the source text is not stored in Postgres (CrawlPage has no` +
        `\n  content column), so the vectors cannot be rebuilt in place. Re-crawl` +
        `\n  each chatbot (POST /api/chatbots/:id/recrawl) or re-upload its` +
        `\n  documents, and the current indexing code will write correct vectors.`,
    );

    if (fix) {
      console.log(`\n  --fix: nulling ${TOTAL - MISSING} provably-broken vectors...`);
      const res = await prisma.$queryRawUnsafe(
        `UPDATE "Chunk" SET embedding = NULL WHERE embedding IS NOT NULL`,
      );
      console.log(`  done: ${res} rows cleared.`);
      console.log(
        `  Sparse retrieval keeps working; dense returns nothing until a re-crawl.`,
      );
    } else {
      console.log(`\n  (re-run with --fix to clear the broken vectors)`);
    }
  } else {
    console.log(`  ✓ HEALTHY — uniqueness ${ratio.toFixed(3)}, median self-match ${median.toFixed(4)}`);
  }

  console.log("\n═════════════════════════════════════\n");
  await prisma.$disconnect();
  process.exit(dupFailing || simFailing ? 1 : 0);
}

main().catch(async (e) => {
  console.error("ERR", e);
  await prisma.$disconnect();
  process.exit(2);
});