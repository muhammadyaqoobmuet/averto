import prisma from "../lib/prisma";
import { logger } from "../utils/logger";
import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} from "@langchain/textsplitters";
import { RawVoyageEmbeddings } from "../utils/voyage";
import crypto from "crypto";

// ── Chunking configuration ───────────────────────────────────────────────────
//
// Why 800 chars and not the previous 1200?
//   1200 characters is roughly 300 tokens of fairly dense prose. An LLM given
//   a 300-token blob with a question about one specific fact has to sift a lot
//   of irrelevant material, which measurably increases both latency and
//   hallucination. ~800 chars (~200 tokens) is the sweet spot for
//   support-style factual Q&A: small enough to be dense with the answer,
//   large enough to still contain the sentence that answers the question.
//
// Why 150 overlap?
//   ~15% overlap. The old 130/1200 (~11%) was thin enough that a fact
//   straddling a split boundary got cut in half, and each half became
//   unanswerable on its own. A sentence of overlap is ~2x the average English
//   sentence length, so the boundary case is usually covered by at least one
//   of the two chunks.
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

// Chunks shorter than this are navigation noise, table-of-contents stubs, or
// a stray sentence orphaned by splitting. Keeping them costs tokens and
// pollutes retrieval with context that answers nothing.
const MIN_CHUNK_LENGTH = 50;

// Max rows per INSERT statement. Postgres allows 65535 bind parameters; with
// 7 columns per row we stay well clear at 200 rows = 1400 params.
const INSERT_BATCH_SIZE = 200;

// A heading path deeper than this is usually site chrome ("Home > Blog > ...")
// rather than meaningful document structure.
const MAX_HEADING_DEPTH = 4;

interface PreparedChunk {
  /** Raw chunk text — what we store in `Chunk.content` and feed to the LLM. */
  content: string;
  /** Heading breadcrumb ("Pricing > Enterprise"), may be null. */
  heading: string | null;
  /**
   * What we actually embed. Prefixing the heading gives the embedding the
   * structural context it would otherwise lack, so a chunk that says only
   * "$99 per seat per month" still lands near queries about "pricing".
   */
  embedText: string;
}

/**
 * Extracts the heading that governs each chunk.
 *
 * ── The problem this solves ────────────────────────────────────────────────
 * `MarkdownTextSplitter` splits on `#` lines but does NOT report which
 * section a resulting chunk came from. The old code tried to read
 * `metadata.heading`, which was always undefined, so every stored heading was
 * NULL. Downstream that meant every citation rendered as the generic word
 * "Page" and the LLM received no structural signal about where in the
 * document a fact lived.
 *
 * ── How ───────────────────────────────────────────────────────────────────
 * For each chunk we find the character offset at which it begins in the
 * original document (LangChain chunks are contiguous, unmodified slices in
 * document order), then binary-search for the last heading at or before that
 * offset. We keep a stack of the last MAX_HEADING_DEPTH headings so we can
 * produce a breadcrumb like "Docs > Billing > Invoices" rather than just the
 * innermost heading.
 *
 * ── Why a moving cursor, not plain indexOf ─────────────────────────────────
 * A plain `originalText.indexOf(chunk)` always returns the FIRST occurrence.
 * Real documents repeat text — nav menus, footer links, boilerplate notices —
 * so every repeat would be assigned the heading of whichever section happened
 * to contain the first copy. Chunks arrive in document order, so we advance a
 * cursor past each match and search from there, which resolves duplicates to
 * their true positions.
 */
function extractHeadings(
  originalText: string,
  chunks: string[],
  isMarkdown: boolean,
): (string | null)[] {
  if (!isMarkdown) return chunks.map(() => null);

  // Precompute every heading in the document once: line start offset, level,
  // and text. Walking this per chunk would be O(chunks × lines).
  interface HeadingMark {
    offset: number;
    level: number;
    text: string;
  }

  const marks: HeadingMark[] = [];
  const headingRegex = /^(#{1,6})\s+(.+?)\s*#*$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(originalText)) !== null) {
    marks.push({
      offset: match.index,
      level: match[1].length,
      text: match[2].trim(),
    });
  }

  if (marks.length === 0) return chunks.map(() => null);

  // Chunks are contiguous slices in order, so track how far we've scanned.
  let cursor = 0;

  return chunks.map((chunk) => {
    const index = originalText.indexOf(chunk, cursor);
    if (index < 0) {
      // Fall back to a global search: if a chunk was trimmed or normalised,
      // it may no longer appear verbatim. Missing a match here costs a
      // heading, not correctness.
      const fallback = originalText.indexOf(chunk);
      if (fallback < 0) return null;
      cursor = fallback + 1;
      return breadcrumbFor(marks, fallback);
    }

    // Resume the next search just past this chunk's end, so an identical
    // later chunk is not matched against this same occurrence.
    cursor = index + chunk.length;

    return breadcrumbFor(marks, index);
  });
}

/**
 * Returns the "Parent > Child > Leaf" breadcrumb for the last heading at or
 * before `offset`, or null if the offset precedes every heading.
 */
function breadcrumbFor(
  marks: Array<{ offset: number; level: number; text: string }>,
  offset: number,
): string | null {
  // Binary-search the last heading that starts at or before this offset.
  let lo = 0;
  let hi = marks.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (marks[mid].offset <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return null;

  // Walk backwards collecting the ancestor breadcrumb. Start at the found
  // heading, then keep looking for a strictly shallower parent.
  const trail = [marks[found]];
  let currentLevel = marks[found].level;
  for (let i = found - 1; i >= 0 && trail.length < MAX_HEADING_DEPTH; i--) {
    if (marks[i].level < currentLevel) {
      trail.unshift(marks[i]);
      currentLevel = marks[i].level;
    }
  }

  const breadcrumb = trail.map((m) => m.text).join(" > ");
  return breadcrumb || null;
}

/**
 * Splits a page and pairs every chunk with its heading.
 *
 * Async because LangChain's `createDocuments` is promise-based.
 * Exported so the heading logic — the trickiest part of indexing — can be
 * verified in isolation.
 */
export async function prepareChunks(
  content: string,
  isMarkdown: boolean,
  meta: Record<string, unknown>,
): Promise<PreparedChunk[]> {
  const splitter = isMarkdown
    ? new MarkdownTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP })
    : new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
      });

  const docs = await splitter.createDocuments([content], [meta]);
  const texts = docs.map((d) => d.pageContent);
  const headings = extractHeadings(content, texts, isMarkdown);

  return texts
    .map((text, i) => {
      const trimmed = text.trim();
      const heading = headings[i];
      return {
        content: trimmed,
        heading,
        // Heading goes first, then a blank line, then the body. Leading
        // context matters because embedding models weight the beginning of a
        // passage more heavily than the end.
        embedText: heading ? `${heading}\n\n${trimmed}` : trimmed,
      };
    })
    .filter((c) => c.content.length > MIN_CHUNK_LENGTH);
}

/**
 * Chunks and embeds a page's content into the vector store.
 *
 * Uses Voyage AI (voyage-3, 1024 dims) for embeddings and pgvector for storage.
 * Vectors are inserted via Prisma.sql with an explicit '[v1,v2,...]' string
 * because pgvector expects that text format — Prisma's array binding uses '{}'
 * which is a PostgreSQL array literal and may not cast correctly to `vector`.
 *
 * Deletes any existing chunks for this pageId before inserting new ones,
 * so re-indexing (recrawl, content update) doesn't leave duplicate/stale chunks.
 *
 * @returns Number of chunks successfully indexed.
 */
export async function indexPageContent(
  chatbotId: string,
  pageId: string,
  content: string,
  isMarkdown: boolean,
): Promise<number> {
  // 1. Split into heading-aware chunks
  const chunks = await prepareChunks(content, isMarkdown, { chatbotId, pageId });
  if (chunks.length === 0) return 0;

  const withHeadings = chunks.filter((c) => c.heading).length;

  // 2. Generate embeddings in one batched call — RawVoyageEmbeddings handles
  //    the 96-per-request chunking internally, so a 500-chunk page is ~5
  //    HTTP requests rather than 500.
  const embedder = new RawVoyageEmbeddings({
    apiKey: process.env.VOYAGEAI_KEY,
  });

  let vectors: number[][];
  try {
    // Embed the heading+content form, NOT the raw content — the heading is
    // what makes a context-free fragment findable.
    vectors = await embedder.embedDocuments(chunks.map((c) => c.embedText));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error(
      `[Indexing] Voyage embedding failed for page ${pageId}: ${message}`,
    );
    return 0;
  }

  // 2.5 Remove any previously indexed chunks for this page before inserting fresh ones.
  // This runs only after embeddings succeed, so a failed embed call never wipes
  // existing good chunks for the page.
  try {
    const deleted = await prisma.chunk.deleteMany({ where: { pageId } });
    if (deleted.count > 0) {
      logger.info(
        `[Indexing] Removed ${deleted.count} stale chunk(s) for page ${pageId} before re-indexing`,
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error(
      `[Indexing] Failed to clear old chunks for page ${pageId}: ${message}`,
    );
    return 0;
  }

  // 3. Insert in multi-row batches.
  //
  // The previous implementation issued one INSERT round-trip per chunk inside
  // a loop. For a 200-page crawl at ~20 chunks/page that's ~4000 sequential
  // round-trips — minutes of pure network latency, and the crawler holds a
  // worker slot the whole time. A single multi-row INSERT does the same work
  // in a handful of statements.
  let insertedCount = 0;

  for (let offset = 0; offset < chunks.length; offset += INSERT_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + INSERT_BATCH_SIZE);

    // Build one parameterised statement for the whole batch.
    // Values are: id, chatbotId, pageId, content, heading, vector.
    const params: unknown[] = [];
    const valueGroups: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i];
      // Positional lookup against the full vectors array — `batch[i]` is the
      // i-th chunk of this batch, which lives at `offset + i` overall.
      const vector = vectors[offset + i];
      if (!vector || vector.length !== 1024) {
        logger.warn(
          `[Indexing] Skipping chunk at offset ${offset + i} — unexpected dimension (${vector?.length})`,
        );
        continue;
      }

      params.push(
        crypto.randomUUID(),
        chatbotId,
        pageId,
        chunk.content,
        chunk.heading,
        `[${vector.join(",")}]`,
      );

      const base = params.length - 6;
      valueGroups.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::vector)`,
      );
    }

    if (valueGroups.length === 0) continue;

    try {
      const affected = await prisma.$executeRawUnsafe(
        `INSERT INTO "Chunk" (id, "chatbotId", "pageId", content, heading, embedding)
         VALUES ${valueGroups.join(", ")}`,
        ...params,
      );
      insertedCount += affected;
    } catch (err: unknown) {
      // Fall back to per-row inserts for just this batch so one malformed row
      // can't cost us the other 199.
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.warn(
        `[Indexing] Batch insert failed (${valueGroups.length} rows): ${message} — retrying row by row`,
      );
      insertedCount += await insertRowsIndividually(
        batch,
        vectors.slice(offset, offset + batch.length),
        chatbotId,
        pageId,
      );
    }
  }

  logger.info(
    `[Indexing] Indexed ${insertedCount}/${chunks.length} chunks for page ${pageId} (${withHeadings} with headings)`,
  );
  return insertedCount;
}

/**
 * Per-row insert fallback used when a multi-row batch fails.
 *
 * Isolated so the main loop stays readable. Errors are logged and skipped
 * rather than thrown: a single bad row should degrade indexing quality, not
 * abort the page.
 */
async function insertRowsIndividually(
  chunks: PreparedChunk[],
  vectors: number[][],
  chatbotId: string,
  pageId: string,
): Promise<number> {
  let count = 0;
  for (let i = 0; i < chunks.length; i++) {
    const vector = vectors[i];
    if (!vector || vector.length !== 1024) continue;

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Chunk" (id, "chatbotId", "pageId", content, heading, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        crypto.randomUUID(),
        chatbotId,
        pageId,
        chunks[i].content,
        chunks[i].heading,
        `[${vector.join(",")}]`,
      );
      count++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.warn(
        `[Indexing] Failed to insert chunk ${i} for page ${pageId}: ${message}`,
      );
    }
  }
  return count;
}