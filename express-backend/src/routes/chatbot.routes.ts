import { Router } from "express";
import {
  createChatbot,
  getChatbots,
  getChatbotStatus,
  updateChatbot,
  deleteChatbot,
  getMissedQueries,
  getChatbotStats,
  getChatbotPages,
  getRecentActivity,
  uploadDocument,
  deletePage,
  recrawlChatbot,
  getConversations,
  getGapReport,
} from "../controllers/chatbot.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate); // All chatbot routes require auth

router.post("/", createChatbot);
router.get("/", getChatbots);
router.get("/:id/status", getChatbotStatus);
router.patch("/:id", updateChatbot);
router.get("/:id/stats", getChatbotStats);
router.get("/:id/pages", getChatbotPages);
router.post("/:id/documents", uploadDocument);
router.delete("/:id/pages/:pageId", deletePage);
router.post("/:id/recrawl", recrawlChatbot);
router.get("/:id/activity", getRecentActivity);
router.get("/:id/missed-queries", getMissedQueries);
router.get("/:id/conversations", getConversations);
router.get("/:id/gap-report", getGapReport);
router.delete("/:id", deleteChatbot);

export default router;
