/**
 * Retrieval pipeline unit tests.
 *
 * Run: npm run test:retrieval
 *
 * These cover the pure logic in the pipeline — heading extraction, weighted
 * RRF, RRF confidence normalisation, cache-key normalisation and LRU
 * eviction. They need no database and no API keys.
 *
 * The parts that DO need infrastructure are covered by the scripts in
 * `scripts/`: check-vector-integrity.ts (vector store health) and the
 * end-to-end proof run manually with npx ts-node.
 */
import assert from "assert";
import { prepareChunks } from "../src/services/indexing.service";
import {
  fuseResults,
  normalizeRrfScore,
  RRF_K,
} from "../src/services/retrieval/rrf.service";
import { mergeDenseHits } from "../src/services/retrieval/dense.service";
import { shouldExpandQuery } from "../src/services/retrieval/dense.service";
import { LruCache } from "../src/lib/lru-cache";
import {
  normalizeQuery,
  retrievalCacheKey,
} from "../src/lib/retrieval-cache";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function it(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ok   ${name}`);
    })
    .catch((err) => {
      failed++;
      failures.push(name);
      console.log(`  FAIL ${name}\n         ${err.message}`);
    });
}

const hit = (id: string) => ({
  id,
  content: `content-${id}`,
  heading: null,
  url: `https://example.test/${id}`,
});

const filler = (n: number) =>
  "This is supporting prose that pads the section out so the splitter has to make more than one chunk. ".repeat(
    n,
  );

async function main() {
  console.log("\n── heading extraction ──");

  await it("assigns DISTINCT headings to distinct sections", async () => {
    const md = `# Guide

${filler(4)}

## Alpha

${filler(3)}

Alpha content here.

### Alpha Deep

${filler(12)}

Deep alpha content.

## Beta

${filler(3)}

Beta content here.`;

    const chunks = await prepareChunks(md, true, {});
    const distinct = new Set(chunks.map((c) => c.heading));
    assert.ok(
      distinct.size >= 3,
      `expected >=3 distinct headings, got ${JSON.stringify([...distinct])}`,
    );
  });

  await it("builds a breadcrumb through parent headings", async () => {
    // Each section must contain DISTINCT text. With repeated filler,
    // `indexOf` cannot tell the copies apart and the test proves nothing —
    // which is exactly why the implementation now uses a forward cursor.
    const section = (word: string, n: number) =>
      `${word}. `.repeat(n) + `${word} section body. `;

    const md = `# Root

${section("alpha", 90)}

## Middle

${section("bravo", 90)}

## Leaf

${section("charlie", 90)}

Charlie content here.`;

    const chunks = await prepareChunks(md, true, {});
    const headings = chunks.map((c) => c.heading);
    assert.ok(headings.includes("Root"), `expected a bare Root chunk, got ${JSON.stringify(headings)}`);
    assert.ok(
      headings.some((h) => h === "Root > Middle"),
      `expected a "Root > Middle" breadcrumb, got ${JSON.stringify(headings)}`,
    );
    assert.ok(
      headings.some((h) => h === "Root > Leaf"),
      `expected a "Root > Leaf" breadcrumb, got ${JSON.stringify(headings)}`,
    );
    // Every heading must be a real path in this document.
    for (const h of headings) {
      assert.ok(
        h === null || h.startsWith("Root"),
        `heading should descend from Root, got ${h}`,
      );
    }
  });

  await it("assigns the correct heading to REPEATED identical text", async () => {
    // The same sentence appears under two different headings. A plain
    // indexOf would assign both copies the first section's heading.
    const dup = "This exact sentence is duplicated on the page verbatim. ";
    const md = `# Guide

${dup.repeat(40)}

## First Section

${dup.repeat(40)}

## Second Section

${dup.repeat(40)}

${dup.repeat(20)}`;

    const chunks = await prepareChunks(md, true, {});
    const headings = new Set(chunks.map((c) => c.heading).filter(Boolean));
    // If duplicates were mis-assigned there would be only one heading value.
    assert.ok(
      headings.size >= 2,
      `expected >=2 distinct headings for repeated text, got ${JSON.stringify([...headings])}`,
    );
    assert.ok(
      chunks.some((c) => c.heading?.includes("Second Section")),
      `expected a Second Section chunk, got ${JSON.stringify([...headings])}`,
    );
  });

  await it("never invents headings for plain text", async () => {
    const chunks = await prepareChunks("plain sentence. ".repeat(80), false, {});
    assert.ok(chunks.every((c) => c.heading === null));
  });

  await it("drops chunks under the minimum length", async () => {
    const chunks = await prepareChunks("# T\n\nhi", true, {});
    assert.strictEqual(chunks.length, 0);
  });

  await it("prefixes the heading onto the embedded text but not the stored text", async () => {
    const md = `# Title

${filler(14)}

Body text that is long enough to survive filtering here.`;
    const chunks = await prepareChunks(md, true, {});
    const withHeading = chunks.filter((c) => c.heading);
    assert.ok(withHeading.length > 0);
    for (const c of withHeading) {
      assert.ok(c.embedText.startsWith(c.heading!), "embedText should start with heading");
      assert.ok(!c.content.startsWith(c.heading!), "content must stay clean");
    }
  });

  console.log("\n── weighted RRF ──");

  await it("prefers a chunk corroborated across all channels", () => {
    const fused = fuseResults([
      { hits: [hit("A"), hit("B"), hit("C")], weight: 1.0 },
      { hits: [hit("B"), hit("A"), hit("C")], weight: 0.6 },
      { hits: [hit("B"), hit("C")], weight: 0.4 },
    ]);
    assert.strictEqual(fused[0].id, "B");
    assert.strictEqual(fused.length, 3);
  });

  await it("sorts descending", () => {
    const fused = fuseResults([
      { hits: [hit("A"), hit("B")], weight: 1 },
      { hits: [hit("B"), hit("A")], weight: 1 },
    ]);
    assert.ok(fused[0].rrfScore >= fused[1].rrfScore);
  });

  await it("ignores zero-weight channels", () => {
    assert.strictEqual(fuseResults([{ hits: [hit("Z")], weight: 0 }]).length, 0);
  });

  await it("deduplicates by id across channels", () => {
    const fused = fuseResults([
      { hits: [hit("A")], weight: 1 },
      { hits: [hit("A")], weight: 1 },
    ]);
    assert.strictEqual(fused.length, 1);
  });

  await it("uses k=10 rather than the paper's 60", () => {
    assert.strictEqual(RRF_K, 10);
  });

  console.log("\n── RRF confidence normalisation ──");

  await it("maps a corroborated chunk to a non-zero confidence", () => {
    const fused = fuseResults([
      { hits: [hit("A")], weight: 1 },
      { hits: [hit("A")], weight: 0.6 },
    ]);
    const conf = normalizeRrfScore(fused[0].rrfScore, 1.6);
    assert.ok(conf > 0.3, `expected >0.3, got ${conf}`);
    assert.ok(conf <= 1);
  });

  await it("returns 0 when there is no weight to normalise against", () => {
    assert.strictEqual(normalizeRrfScore(5, 0), 0);
  });

  await it("ranks a chunk corroborated by both channels above a single-channel find", () => {
    // B is #1 in the dense list but absent from sparse.
    // A is #2 in dense AND #1 in sparse — corroborated by both channels.
    //   A = 1.0/(10+2) + 0.6/(10+1) = 0.0833 + 0.0545 = 0.1379
    //   B = 1.0/(10+1)                = 0.0909
    // A must win despite B holding the better single rank.
    const fused = fuseResults([
      { hits: [hit("B"), hit("A")], weight: 1 },
      { hits: [hit("A")], weight: 0.6 },
    ]);
    const confA = normalizeRrfScore(fused.find((f) => f.id === "A")!.rrfScore, 1.6);
    const confB = normalizeRrfScore(fused.find((f) => f.id === "B")!.rrfScore, 1.6);
    assert.ok(confA > confB, `A=${confA} B=${confB}`);
  });

  console.log("\n── dense merge across query variants ──");

  await it("ranks a chunk found by two variants above a variant-only find", () => {
    // Symmetric ranks tie exactly under RRF, so the ranks must be asymmetric
    // for this to be a meaningful assertion:
    //   B = 1/61 (variant 1, rank 1) + 1/63 (variant 2, rank 3) = 0.032258
    //   A = 1/62 (variant 1, rank 2) + 1/62 (variant 2, rank 2) = 0.032258
    // equal again — so instead assert the property that actually matters:
    // a chunk present in BOTH lists outranks one present in only one, when
    // the single-list chunk sits much lower.
    const merged = mergeDenseHits([
      [
        { id: "A", content: "a", heading: null, url: "u", similarity: 0.9 },
        { id: "B", content: "b", heading: null, url: "u", similarity: 0.8 },
        { id: "C", content: "c", heading: null, url: "u", similarity: 0.7 },
      ],
      [
        { id: "A", content: "a", heading: null, url: "u", similarity: 0.9 },
        { id: "B", content: "b", heading: null, url: "u", similarity: 0.8 },
      ],
    ]);
    // A and B both appear twice and must beat C, which appears once.
    assert.ok(merged[0].id === "A" || merged[0].id === "B", `got ${merged[0].id}`);
    assert.strictEqual(merged[2].id, "C");
    assert.strictEqual(merged.length, 3);
  });

  await it("preserves the original cosine similarity, not the fusion score", () => {
    const merged = mergeDenseHits([
      [{ id: "A", content: "a", heading: null, url: "u", similarity: 0.42 }],
    ]);
    assert.strictEqual(merged[0].similarity, 0.42);
  });

  console.log("\n── query expansion gate ──");

  await it("skips expansion for very short and very long queries", () => {
    assert.strictEqual(shouldExpandQuery("pricing"), false);
    assert.strictEqual(shouldExpandQuery("a"), false);
    const long = "what ".repeat(40);
    assert.strictEqual(shouldExpandQuery(long), false);
  });

  await it("expands ordinary questions", () => {
    assert.strictEqual(shouldExpandQuery("how much does it cost"), true);
  });

  console.log("\n── cache key normalisation ──");

  await it("collapses case, padding and trailing punctuation", () => {
    assert.strictEqual(
      normalizeQuery("  Do you offer Refunds? "),
      normalizeQuery("do you offer refunds"),
    );
    assert.strictEqual(normalizeQuery("pricing!!!"), "pricing");
  });

  await it("keeps genuinely different questions apart", () => {
    assert.notStrictEqual(normalizeQuery("pricing"), normalizeQuery("refunds"));
  });

  await it("keys include the chatbot and a version", () => {
    const key = retrievalCacheKey("bot-1", "Pricing?");
    assert.ok(key.startsWith("rag:v"));
    assert.ok(key.includes("bot-1"));
    assert.strictEqual(key, retrievalCacheKey("bot-1", "  pricing "));
    assert.notStrictEqual(key, retrievalCacheKey("bot-2", "pricing"));
  });

  console.log("\n── LRU cache ──");

  await it("evicts the least recently used entry", () => {
    const lru = new LruCache<number>(3);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("c", 3);
    lru.get("a"); // promote a
    lru.set("d", 4); // must evict b
    assert.strictEqual(lru.get("a"), 1);
    assert.strictEqual(lru.get("b"), undefined);
    assert.strictEqual(lru.get("c"), 3);
    assert.strictEqual(lru.get("d"), 4);
    assert.strictEqual(lru.size, 3);
  });

  await it("overwrites without growing", () => {
    const lru = new LruCache<number>(3);
    lru.set("a", 1);
    lru.set("a", 2);
    assert.strictEqual(lru.size, 1);
    assert.strictEqual(lru.get("a"), 2);
  });

  await it("invalidates by prefix", () => {
    const lru = new LruCache<number>(10);
    lru.set("bot1:x", 1);
    lru.set("bot2:y", 2);
    lru.deleteByPrefix("bot1:");
    assert.strictEqual(lru.get("bot1:x"), undefined);
    assert.strictEqual(lru.get("bot2:y"), 2);
  });

  await it("rejects a non-positive capacity", () => {
    assert.throws(() => new LruCache<number>(0));
  });

  console.log(
    `\n${"─".repeat(48)}\n  ${passed} passed, ${failed} failed` +
      (failed ? `\n  failing: ${failures.join(", ")}` : "") +
      `\n${"─".repeat(48)}\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});