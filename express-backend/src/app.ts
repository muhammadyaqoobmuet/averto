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

// ── Widget CORS ────────────────────────────────────────────────────────────
// The /api/chat endpoint is called by the embeddable widget from ANY website
// the customer embeds it on. Authentication is via the API key in the request
// body, so CORS itself can stay open here.
// Server-side allowedOrigins enforcement (per-chatbot, set by the user in the
// dashboard) happens inside the chat controller — that's the real security
// boundary, not this middleware.
app.use(
  "/api/chat",
  cors({
    origin: true,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ── Dashboard / auth CORS — restricted to our own frontend origin ──────────
// This is NOT user-configurable — it's the CORS policy for our own
// dashboard app talking to our own API, so a static origin is correct.
const dashboardCors = cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
});

app.use(helmet());
app.use(pinohttp);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Routes ───────────────────────────────────────────────────────────────────
// dashboardCors is applied per-route now, NOT globally — otherwise it
// overwrites the widget CORS headers set above for /api/chat.
app.use("/api/auth", dashboardCors, authRoutes);
app.use("/api/chatbots", dashboardCors, chatbotRoutes);
app.use("/api/chat", chatRoutes); // CORS already handled above for this path

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
