import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import chatbotRoutes from "./routes/chatbot.routes";
import chatRoutes from "./routes/chat.routes";

import { globalErrorHandler } from "./utils/errors";
import { pinohttp } from "./utils/http-logger";

dotenv.config();

const app = express();

// ── Widget CORS —────────────────────
// The /api/chat endpoint is called by the embeddable widget from ANY website.
// Authentication is via the API key in the request body, so CORS can be open.
// Server-side allowedOrigins enforcement happens inside the chat controller.
app.use(
  "/api/chat",
  cors({
    origin: "*",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ── Dashboard / auth CORS — restricted to the frontend origin ────────────────
const dashboardCors = cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
});

app.use(helmet());
app.use(dashboardCors);
app.use(pinohttp);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/chatbots", chatbotRoutes);
app.use("/api/chat", chatRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
