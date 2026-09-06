import { config } from "../config.js";
import { getMarketInstruments } from "../market/instruments.js";
import { buildIntentPrompt } from "./prompts.js";
import {
  aiIntentRequestSchema,
  aiIntentResultSchema,
  type AiIntentRequest,
  type AiIntentResponse
} from "./types.js";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const createFallbackResponse = (
  error: string
): AiIntentResponse => ({
  source: "fallback",
  error,
  intent: {
    action: "UNKNOWN",
    metrics: [],
    requiresConfirmation: true,
    clarificationQuestion:
      "AI 해석을 사용할 수 없어 기존 키워드 명령으로 처리해야 합니다.",
    confidence: 0
  }
});

const extractJsonText = (text: string): string => {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
};

const readGeminiText = (
  response: GeminiGenerateContentResponse
): string | null => {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text)
    .filter((partText): partText is string => Boolean(partText))
    .join("\n")
    .trim();

  return text || null;
};

export const parseAiIntent = async (
  rawRequest: unknown
): Promise<AiIntentResponse> => {
  const parsedRequest = aiIntentRequestSchema.safeParse(rawRequest);

  if (!parsedRequest.success) {
    return createFallbackResponse("Invalid AI intent request.");
  }

  if (!config.GEMINI_API_KEY) {
    return createFallbackResponse("GEMINI_API_KEY is not configured.");
  }

  const request: AiIntentRequest = parsedRequest.data;
  const prompt = buildIntentPrompt(
    request,
    getMarketInstruments()
  );
  const model = encodeURIComponent(config.GEMINI_MODEL);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`;

  try {
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      return createFallbackResponse(
        `Gemini request failed with ${geminiResponse.status}.`
      );
    }

    const geminiBody =
      (await geminiResponse.json()) as GeminiGenerateContentResponse;
    const rawText = readGeminiText(geminiBody);

    if (!rawText) {
      return createFallbackResponse("Gemini returned an empty response.");
    }

    const jsonText = extractJsonText(rawText);
    const result = aiIntentResultSchema.parse(
      JSON.parse(jsonText)
    );

    return {
      source: "gemini",
      intent: result,
      rawText
    };
  } catch (error) {
    return createFallbackResponse(
      error instanceof Error
        ? error.message
        : "Gemini intent parsing failed."
    );
  }
};
