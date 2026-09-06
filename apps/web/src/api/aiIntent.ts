export interface AiIntent {
  action: "START_REALTIME" | "STOP" | "REPLAY_LAST" | "REPLAY_RECENT" | "INFO" | "ASK_CLARIFICATION" | "UNKNOWN";
  symbol?: string | null;
  metrics: Array<"price" | "volume" | "changeRate">;
  timeRange?: string | null;
  thresholdRate?: number | null;
  requiresConfirmation: boolean;
  clarificationQuestion?: string | null;
  confidence: number;
}

export const requestAiIntent = async (
  utterance: string,
  context: { currentSymbol: string; currentStockName: string; previousUtterance?: string },
  signal: AbortSignal
): Promise<AiIntent | null> => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  const socketUrl = new URL(import.meta.env.VITE_WEBSOCKET_URL ?? "ws://localhost:4000/ws");
  const base = configured || `${socketUrl.protocol === "wss:" ? "https:" : "http:"}//${socketUrl.host}`;
  const response = await fetch(`${base.replace(/\/$/, "")}/api/ai/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utterance, context }),
    signal
  });
  if (!response.ok) return null;
  const body = await response.json();
  const intent = body?.intent;
  if (body?.source !== "gemini" || !intent ||
      !["START_REALTIME", "STOP", "REPLAY_LAST", "REPLAY_RECENT", "INFO", "ASK_CLARIFICATION", "UNKNOWN"].includes(intent.action) ||
      !Array.isArray(intent.metrics) || !intent.metrics.every((m: unknown) => ["price", "volume", "changeRate"].includes(String(m))) ||
      typeof intent.requiresConfirmation !== "boolean" ||
      typeof intent.confidence !== "number" || !Number.isFinite(intent.confidence) ||
      (intent.symbol != null && typeof intent.symbol !== "string") ||
      (intent.timeRange != null && typeof intent.timeRange !== "string") ||
      (intent.clarificationQuestion != null && typeof intent.clarificationQuestion !== "string") ||
      (intent.thresholdRate != null && (typeof intent.thresholdRate !== "number" || !Number.isFinite(intent.thresholdRate) || intent.thresholdRate < 0))) return null;
  return intent as AiIntent;
};

export const replaySeconds = (range?: string | null): number | null => {
  const match = range?.trim().match(/^(?:최근\s*|last\s*)?(\d+)\s*(s|sec|seconds?|초|m|min|minutes?|분)$/i);
  if (!match) return null;
  const seconds = Number(match[1]) * (/^(m|min|minute|minutes|분)$/i.test(match[2]!) ? 60 : 1);
  return [60, 180, 300].includes(seconds) ? seconds : null;
};
