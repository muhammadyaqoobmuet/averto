import prisma from "../lib/prisma";
import { logger } from "../utils/logger";
import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} from "@langchain/textsplitters";
import { RawVoyageEmbeddings } from "../utils/voyage";
import crypto from "crypto";

/**
 * Chunks and embeds a page's content into the vector store.
 *
 * Uses Voyage AI (voyage-3, 1024 dims) for embeddings and pgvector for storage.
 * Vectors are inserted via $executeRawUnsafe with an explicit '[v1,v2,...]' string
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
  // 1. creatng a splitter
  const splitter = isMarkdown
    ? new MarkdownTextSplitter({ chunkSize: 1200, chunkOverlap: 130 })
    : new RecursiveCharacterTextSplitter({
        chunkSize: 1200,
        chunkOverlap: 130,
      });

  // then we are spliting docs  and creating chunks of docs
  let docs = await splitter.createDocuments([content], [{ chatbotId, pageId }]); // result of this will look like [{ pageContent: "", metadata: { chatbotId, pageId } }]
  // filtering meaning chunks with less than 50 characters are discarded
  docs = docs.filter((d) => d.pageContent.trim().length > 50); // storing only chunks with meaningful content
  if (docs.length === 0) return 0;

  // 2. Generate embeddings — RawVoyageEmbeddings batches internally (96 per request)
  const embedder = new RawVoyageEmbeddings({
    apiKey: process.env.VOYAGEAI_KEY,
  });
  let vectors: number[][];  // [[1024],[1024],...]
  try {
    vectors = await embedder.embedDocuments(docs.map((d) => d.pageContent));
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

  // 3. Insert each chunk + its vector into the database
  let insertedCount = 0;
  for (let i = 0; i < docs.length; i++) {
    const vector = vectors[i];
    if (!vector || vector.length !== 1024) {
      // voyage-3 returns 1024-dim vectors
      logger.warn(
        `[Indexing] Skipping chunk ${i} — unexpected dimension (${vector?.length})`,
      );
      continue;
    }
    const id = crypto.randomUUID();
    const chunkContent = docs[i].pageContent;
    const heading =
      ((docs[i].metadata as Record<string, unknown>).heading as string) ?? null;
    // pgvector's text input format is '[v1,v2,...]'.
    // We build it explicitly instead of relying on Prisma's array serialisation.
    const vectorStr = `[${vector.join(",")}]`;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Chunk" (id, "chatbotId", "pageId", content, heading, embedding)
                 VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        id,
        chatbotId,
        pageId,
        chunkContent,
        heading,
        vectorStr,
      );
      insertedCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.warn(
        `[Indexing] Failed to insert chunk ${i} for page ${pageId}: ${message}`,
      );
    }
  }
  logger.info(
    `[Indexing] Indexed ${insertedCount}/${docs.length} chunks for page ${pageId}`,
  );
  return insertedCount;
}
