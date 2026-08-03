import { Request, Response } from "express";
import { Queue } from "bullmq";
import {
  createChatbotSchema,
  updateChatbotSchema,
  uploadDocumentSchema,
} from "../utils/schemas";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// Fix: pass URL string config directly to avoid ioredis version conflict with bullmq
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const crawlQueue = new Queue("crawl-queue", {
  connection: { url: REDIS_URL },
});
const documentQueue = new Queue("document-queue", {
  connection: { url: REDIS_URL },
});

/**
 * Creates a new chatbot and initiates the initial website crawl.
 */
export const createChatbot = async (req: AuthRequest, res: Response) => {
  try {
    const { name, websiteUrl, orgId, pageLimit } = createChatbotSchema.parse(
      req.body,
    );
    // chatbot name , website url to crawl , orgId we saving and giving to user , page limit to crawl
    // Verify organization ownership
    const org = await prisma.organization.findFirst({
      where: { id: orgId, ownerId: req.user!.userId },
    });
    if (!org)
      return res
        .status(403)
        .json({ error: "Organization not found or access denied" });

    const chatbot = await prisma.chatbot.create({
      data: {
        name,
        websiteUrl,
        orgId,
        status: "pending",
        pageLimit: pageLimit ?? 10,
      },
    });

    // 1. Queue the crawl job for the Python service to pick up
    await crawlQueue.add(
      "crawl-job",
      {
        chatbotId: chatbot.id,
        url: websiteUrl,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    res.status(201).json(chatbot);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Retrieves all chatbots belonging to a specific organization.
 */
export const getChatbots = async (req: AuthRequest, res: Response) => {
  const { orgId } = req.query;
  if (!orgId) return res.status(400).json({ error: "orgId required" });

  const org = await prisma.organization.findFirst({
    where: { id: orgId as string, ownerId: req.user!.userId },
  });
  if (!org)
    return res
      .status(403)
      .json({ error: "Organization not found or access denied" });

  const chatbots = await prisma.chatbot.findMany({
    where: { orgId: orgId as string },
    orderBy: { createdAt: "desc" },
  });

  res.json(chatbots);
};

/**
 * Fetches the current status and configuration of a specific chatbot.
 */
export const getChatbotStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      id,
      organization: { ownerId: req.user!.userId },
    },
    select: {
      id: true,
      status: true,
      pagesCrawled: true,
      name: true,
      websiteUrl: true,
      apiKey: true,
      welcomeMessage: true,
      themeColor: true,
      systemPrompt: true,
      allowedDomains: true,
      pageLimit: true,
      crawlMeta: true,
      widgetConfig: true,
    },
  });

  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });
  res.json(chatbot);
};

/**
 * Updates chatbot configuration (name, theme, etc.).
 */
export const updateChatbot = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateChatbotSchema.parse(req.body);

    const chatbot = await prisma.chatbot.findFirst({
      where: { id, organization: { ownerId: req.user!.userId } },
    });
    if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

    const updated = await prisma.chatbot.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        pagesCrawled: true,
        name: true,
        websiteUrl: true,
        apiKey: true,
        welcomeMessage: true,
        themeColor: true,
        systemPrompt: true,
        allowedDomains: true,
        pageLimit: true,
        widgetConfig: true,
      },
    });

    res.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed";
    res.status(400).json({ error: message });
  }
};

/**
 * Deletes a chatbot and all its associated knowledge (pages, chunks).
 */
export const deleteChatbot = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });

  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  await prisma.chatbot.delete({ where: { id } });
  res.json({ success: true });
};

/**
 * Fetches queries that the chatbot struggled to answer (for the Insights tab).
 */
export const getMissedQueries = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  const queries = await prisma.missedQuery.findMany({
    where: { chatbotId: id },
    orderBy: { askedAt: "desc" },
    take: 50,
  });

  res.json(queries);
};

/**
 * Aggregates high-level statistics for the chatbot dashboard.
 */
export const getChatbotStats = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  const [messages, missedQueries, pages, chunks, conversations] =
    await Promise.all([
      prisma.message.count({ where: { conversation: { chatbotId: id } } }),
      prisma.missedQuery.count({ where: { chatbotId: id } }),
      prisma.crawlPage.count({ where: { chatbotId: id } }),
      prisma.chunk.count({ where: { chatbotId: id } }),
      prisma.conversation.count({ where: { chatbotId: id } }),
    ]);

  res.json({
    messages,
    missedQueries,
    pages,
    chunks,
    conversations,
    status: chatbot.status,
    pagesCrawled: chatbot.pagesCrawled,
    pageLimit: chatbot.pageLimit,
    crawlMeta: chatbot.crawlMeta,
  });
};

/**
 * Lists all indexed sources (pages and documents) for this chatbot.
 */
export const getChatbotPages = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  const pages = await prisma.crawlPage.findMany({
    where: { chatbotId: id },
    orderBy: { crawledAt: "desc" },
    select: {
      id: true,
      url: true,
      title: true,
      crawledAt: true,
      sourceType: true,
      _count: { select: { chunks: true } },
    },
  });

  res.json(pages);
};

/**
 * Handles document uploads (PDF/TXT) by queuing them for background indexing.
 */
export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fileUrl, fileName, mimeType } = uploadDocumentSchema.parse(
      req.body,
    );

    const chatbot = await prisma.chatbot.findFirst({
      where: { id, organization: { ownerId: req.user!.userId } },
    });
    if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

    // Check if page limit exceeded
    const pageCount = await prisma.crawlPage.count({
      where: { chatbotId: id },
    });
    if (pageCount >= chatbot.pageLimit) {
      return res.status(400).json({
        error: `Page limit reached (${chatbot.pageLimit}). Remove sources or increase the limit.`,
      });
    }

    // 1. Enqueue the document indexing job
    const job = await documentQueue.add(
      "index-document",
      {
        chatbotId: id,
        fileUrl,
        fileName,
        mimeType,
      },
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
      },
    );

    console.log(`[Upload] Document ${fileName} queued with job ID ${job.id}`);
    res
      .status(202)
      .json({ jobId: job.id, message: "Document queued for indexing" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("[Upload] Error:", message);
    res.status(400).json({ error: message });
  }
};

/**
 * Removes a single indexed page or document.
 */
export const deletePage = async (req: AuthRequest, res: Response) => {
  const { id, pageId } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  const page = await prisma.crawlPage.findFirst({
    where: { id: pageId, chatbotId: id },
  });
  if (!page) return res.status(404).json({ error: "Page not found" });

  await prisma.crawlPage.delete({ where: { id: pageId } });

  // Update chatbot count metadata
  const totalPages = await prisma.crawlPage.count({ where: { chatbotId: id } });
  await prisma.chatbot.update({
    where: { id },
    data: { pagesCrawled: totalPages },
  });

  res.json({ success: true, pagesCrawled: totalPages });
};

/**
 * Triggers a fresh crawl of the website, replacing old crawled pages.
 */
export const recrawlChatbot = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  if (["pending", "crawling", "indexing"].includes(chatbot.status)) {
    return res.status(400).json({ error: "Crawl already in progress" });
  }

  // Delete old crawled pages but keep manual uploads
  await prisma.crawlPage.deleteMany({
    where: { chatbotId: id, sourceType: "crawl" },
  });

  const totalPages = await prisma.crawlPage.count({ where: { chatbotId: id } });

  await prisma.chatbot.update({
    where: { id },
    data: {
      status: "pending",
      pagesCrawled: totalPages,
      crawlMeta: Prisma.DbNull,
    },
  });

  await crawlQueue.add(
    "crawl-job",
    {
      chatbotId: id,
      url: chatbot.websiteUrl,
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  res.json({ message: "Re-crawl queued", pagesCrawled: totalPages });
};

/**
 * Returns a paginated list of conversations with message count and last message preview.
 * GET /api/chatbots/:id/conversations?page=1&limit=20
 */
export const getConversations = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 20),
  );
  const skip = (page - 1) * limit;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { chatbotId: id },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, role: true },
        },
      },
    }),
    prisma.conversation.count({ where: { chatbotId: id } }),
  ]);

  const data = conversations.map((c) => ({
    id: c.id,
    sessionId: c.sessionId,
    startedAt: c.startedAt,
    messageCount: c._count.messages,
    lastMessage: c.messages[0] ?? null,
  }));

  res.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
};

/**
 * Returns a CSV download of missed queries where topScore < 0.25.
 * GET /api/chatbots/:id/gap-report
 */
export const getGapReport = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  const missedQueries = await prisma.missedQuery.findMany({
    where: { chatbotId: id, topScore: { lt: 0.25 } },
    orderBy: { askedAt: "desc" },
    select: { query: true, topScore: true, askedAt: true },
  });

  const csvRows = ["query,topScore,askedAt"];
  for (const mq of missedQueries) {
    // Escape double-quotes inside the query field (RFC 4180)
    const escapedQuery = `"${mq.query.replace(/"/g, '""')}"`;
    const topScore = mq.topScore ?? 0;
    const askedAt = mq.askedAt.toISOString();
    csvRows.push(`${escapedQuery},${topScore},${askedAt}`);
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=gap-report.csv");
  res.send(csvRows.join("\n"));
};

/**
 * Returns all messages for a single conversation.
 * GET /api/chatbots/:id/conversations/:convId/messages
 */
export const getConversationMessages = async (
  req: AuthRequest,
  res: Response,
) => {
  const { id, convId } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  const conversation = await prisma.conversation.findFirst({
    where: { id: convId, chatbotId: id },
  });
  if (!conversation)
    return res.status(404).json({ error: "Conversation not found" });

  const messages = await prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  res.json(messages);
};

/**
 * Retrieves recent message activity for the dashboard visualization.
 */
export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id, organization: { ownerId: req.user!.userId } },
  });
  if (!chatbot) return res.status(404).json({ error: "Chatbot not found" });

  // Fetch the most recent messages across all conversations for this bot
  const messages = await prisma.message.findMany({
    where: { conversation: { chatbotId: id } },
    orderBy: { createdAt: "desc" },
    take: 30, // Increased limit for better visibility
    select: {
      id: true,
      role: true,
      content: true,
      topScore: true,
      createdAt: true,
      conversation: { select: { sessionId: true } },
    },
  });

  res.json(messages);
};
