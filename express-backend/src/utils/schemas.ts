import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const createChatbotSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().url(),
  orgId: z.string().uuid(),
  pageLimit: z.number().int().min(1).max(200).optional(),
});

export const updateChatbotSchema = z.object({
  name: z.string().min(1).optional(),
  welcomeMessage: z.string().min(1).optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  systemPrompt: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  pageLimit: z.number().int().min(1).max(200).optional(),
  customModel: z.string().optional(),
  customApiKey: z.string().optional(),
  allowedOrigins: z.array(z.string()).optional(),
});

export const uploadDocumentSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

export const chatRequestSchema = z.object({
  query: z.string().min(1),
  sessionId: z.string().optional(),
  apiKey: z.string().uuid(),
});
