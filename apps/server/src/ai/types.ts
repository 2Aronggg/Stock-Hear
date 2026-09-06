import { z } from "zod";

export const aiIntentRequestSchema = z.object({
  utterance: z.string().trim().min(1),
  context: z
    .object({
      currentSymbol: z.string().optional(),
      currentStockName: z.string().optional(),
      previousUtterance: z.string().optional()
    })
    .optional()
});

export const aiIntentResultSchema = z.object({
  action: z.enum([
    "START_REALTIME",
    "STOP",
    "REPLAY_LAST",
    "REPLAY_RECENT",
    "INFO",
    "ASK_CLARIFICATION",
    "UNKNOWN"
  ]),
  symbol: z.string().nullable().optional(),
  stockName: z.string().nullable().optional(),
  market: z.enum(["KR", "US"]).nullable().optional(),
  timeRange: z.string().nullable().optional(),
  metrics: z
    .array(z.enum(["price", "volume", "changeRate"]))
    .default([]),
  thresholdRate: z.number().nullable().optional(),
  requiresConfirmation: z.boolean().default(false),
  clarificationQuestion: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5)
});

export type AiIntentRequest = z.infer<
  typeof aiIntentRequestSchema
>;

export type AiIntentResult = z.infer<typeof aiIntentResultSchema>;

export interface AiIntentResponse {
  source: "gemini" | "fallback";
  intent: AiIntentResult;
  rawText?: string;
  error?: string;
}
