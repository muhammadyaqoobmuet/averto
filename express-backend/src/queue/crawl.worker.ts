import { Worker, Job } from "bullmq";
import axios from "axios";
import prisma from "../lib/prisma";
import { indexPageContent } from "../services/indexing.service";
import { logger } from "../utils/logger";
import fs from "fs";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

interface CrawlResponse {
  pages: { url: string; title?: string; markdown: string }[];
  meta?: {
    discovered: number;
    indexed: number;
    skipped?: string[];
    failed?: { url: string; error: string }[];
  };
}

/**
 * Crawl Worker
 *
 * This background process listens for 'crawl-queue' jobs and coordinates
 * the end-to-end website ingestion pipeline:
 * 1. Requests the Python Crawler service to scrape the target URL.
 * 2. Receives a list of Markdown pages.
 * 3. Iterates through pages and creates database records.
 * 4. Calls the Indexing service to generate and store vector embeddings.
 * 5. Updates the Chatbot status (crawling -> indexing -> ready).
 */
export const crawlWorker = new Worker(
  "crawl-queue",
  async (job: Job) => {
    // TODO ADD JOB LATER LIKE if job.name === 'crawl-job'
    const { chatbotId, url } = job.data;

    try {
      logger.info(
        `[CrawlWorker] Starting job for Bot ${chatbotId} URL: ${url}`,
      );

      // 1. Validate the bot exists before starting
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId },
      });
      if (!chatbot) throw new Error("Chatbot not found");

      const maxPages = Math.min(chatbot.pageLimit || 10, 200);

      // 2. Set status to 'crawling' so the UI can show progress
      await prisma.chatbot.update({
        where: { id: chatbotId },
        data: { status: "crawling" },
      });

      // 3. Communicate with the Python Crawler service via HTTP
      // This is a long-running request (timeout increased to 10 mins)
      const response = await axios.post<CrawlResponse>(
        `${PYTHON_SERVICE_URL}/crawl`,
        {
          url,
          max_pages: maxPages,
        },
        {
          headers: { "X-Internal-Key": INTERNAL_API_KEY },
          timeout: 600000,
        },
      );

      const pages = response.data?.pages;
      const meta = response.data?.meta;   
      
      // STORE THESE ON fILES
      await Promise.all([
        fs.writeFileSync(`pages_${chatbotId}.json`, JSON.stringify(pages)),
        fs.writeFileSync(`meta_${chatbotId}.json`, JSON.stringify(meta)),
      ]);

      if (!pages || pages.length === 0) {
        throw new Error(
          "Ops no pages returned. This might be due to robot.txt blocks or connection issues.",
        );
      }

      // 4. Update status to 'indexing'
      await prisma.chatbot.update({
        where: { id: chatbotId },
        data: {
          status: "indexing",
          pagesCrawled: 0,
          crawlMeta: meta  // 
            ? {
                discovered: meta.discovered,
                indexed: 0,
                skipped: meta.skipped || [],
                failed: meta.failed || [],
                lastCrawlAt: new Date().toISOString(),
              } 
            : undefined,
        },
      });

      // 5. Process and index every page
      let totalChunks = 0;
      let pagesIndexed = 0;

      for (const page of pages) {
        // Skip pages that are too thin to be useful for RAG
        if (!page.markdown || page.markdown.trim().length < 50) {
          logger.warn(
            `[CrawlWorker] Skipping empty or low-quality page: ${page.url}`,
          );
          continue;
        }

        // Create a record for this source early
        const pageRecord = await prisma.crawlPage.create({
          data: {
            chatbotId,
            url: page.url,
            title: page.title || null,
            sourceType: "crawl",
          },
        });

        // Trigger the indexing logic (summarizing, chunking, and embedding)
        const indexed = await indexPageContent(
          chatbotId,
          pageRecord.id,
          page.markdown,
          true, // Content is Markdown from the Python service
        );

        // Cleanup if no useful data was extracted
        if (indexed === 0) {
          await prisma.crawlPage.delete({ where: { id: pageRecord.id } });
          logger.warn(
            `[CrawlWorker] No vectors generated for ${page.url}, record removed.`,
          );
          continue;
        }

        totalChunks += indexed;
        pagesIndexed++;
        logger.info(
          `[CrawlWorker] Page ${page.url} indexed with ${indexed} chunks`,
        );
      }

      // 6. Handle total failure (site crawled but nothing could be indexed)
      if (totalChunks === 0) {
        throw new Error(
          "Crawl completed but no content could be indexed. Site may be empty or incompatible.",
        );
      }

      // 7. Final status update: Ready!
      await prisma.chatbot.update({
        where: { id: chatbotId },
        data: {
          status: "ready",
          pagesCrawled: pagesIndexed,
          crawlMeta: {
            discovered: meta?.discovered ?? pages.length,
            indexed: pagesIndexed,
            skipped: meta?.skipped || [],
            failed: meta?.failed || [],
            totalChunks,
            lastCrawlAt: new Date().toISOString(),
          },
        },
      });

      logger.info(
        `[CrawlWorker] SUCCESS: Bot ${chatbotId}. ${totalChunks} vectors from ${pagesIndexed} pages.`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown crawl error";
      console.error(`[CrawlWorker] ERROR for Bot ${chatbotId}:`, message);

      // Update bot to failed so user sees it in the UI
      await prisma.chatbot
        .update({
          where: { id: chatbotId },
          data: { status: "failed" },
        })
        .catch(() => {});

      throw error; // Let BullMQ handle failure/retries if configured
    }
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 2, // Allow 2 simultaneous crawls
  },
);

crawlWorker.on("completed", (job) => {
  logger.info(`Job ${job?.id} completed`);
});

crawlWorker.on("failed", (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err.message}`);
});
