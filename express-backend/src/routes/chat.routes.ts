import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { chat } from '../controllers/chat.controller';
import { validate } from '../middleware/zodMiddleware';
import { chatRequestSchema } from '../utils/schemas';

const router = Router();

// ── Rate limiting ────────────────────────────────────────────────────────────
//
// This endpoint is public and unauthenticated at the transport layer — the
// chatbot API key in the body is the only credential. Without a limit, anyone
// who scraped a client's key could drive unbounded traffic through Voyage
// embeddings, Voyage rerank and three LLM providers, turning a scraped key
// into a direct bill.
//
// The key is the combination of remote address + chatbot apiKey, so one noisy
// visitor cannot exhaust the whole chatbot's budget for everyone else.
//
// `ipKeyGenerator` (not a raw `req.ip`) is required: an IPv6 address is a
// /64, so a whole subnet can rotate through addresses at will and evade a
// limit keyed on the raw string. The helper normalises them to a /56 bucket.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30, // 30 requests per minute per (IP bucket, chatbot)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const apiKey =
      typeof req.body?.apiKey === 'string' ? req.body.apiKey : 'anonymous';
    return `${ipKeyGenerator(req.ip ?? '')}:${apiKey}`;
  },
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  // Health-checks and load balancers shouldn't consume the quota.
  skip: (req) => req.path === '/health',
});

// Widget endpoint - authenticated via API Key in body.
// `validate` was defined in utils/schemas.ts but never wired to any route, so
// an empty query, a multi-megabyte query string, or a missing apiKey all
// reached the embedding API before failing somewhere deep in the pipeline.
router.post('/', chatLimiter, validate(chatRequestSchema), chat);

export default router;