import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { RawVoyageEmbeddings } from "../../utils/voyage";

export interface DenseHit {
  id: string;
  content: string;
  heading: string | null;
  url: string;
  distance: number;
}

/**
 * Vector similarity search using pgvector (<=> cosine distance).
 *
 * Embeds the query via Voyage AI, then queries the Chunk table ordered by
 * cosine distance. The query vector is passed as a pre-formatted '[v1,v2,...]'
 * string — pgvector's expected text input format — rather than letting Prisma
 * serialise the JS array as '{v1,v2,...}' (PostgreSQL array literal) which may
 * fail the ::vector cast on some pgvector versions.
 */
export async function denseSearch(
  chatbotId: string,
  query: string,
  limit = 25,
): Promise<DenseHit[]> {
  const t0 = Date.now();

  const embedder = new RawVoyageEmbeddings({
    apiKey: process.env.VOYAGEAI_KEY ?? process.env.VOYAGE_API_KEY,
  });

  try {
    const queryVector = await embedder.embedQuery(query);

    // Build the '[v1,v2,...]' string that pgvector's input function expects.
    const vectorStr = `[${queryVector.join(",")}]`;

    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        heading: string | null;
        url: string;
        similarity: number;
      }>
    >(
      Prisma.sql`
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
            `,
    );

    logger.debug(
      `[Dense] Search took ${Date.now() - t0}ms | ${results.length} hits`,
    );

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      heading: r.heading,
      url: r.url ?? "",
      distance: Number(r.similarity),
    }));
  } catch (err: any) {
    logger.error(`[Dense] Search failed: ${err.message}`);
    return [];
  }
}
