import { findStockByUtterance } from "../components/StockSelector";
import type {
  ListeningMode,
  ListeningPreferences,
  ListeningSpeed,
  SonificationMetric,
  SonificationPlan,
  SpeechDetailLevel
} from "../types";

export type VoiceIntent =
  | "select-stock"
  | "start-sonification"
  | "stop-sonification"
  | "read-price"
  | "read-change-rate"
  | "read-volume"
  | "set-preferences"
  | "explain-last-sound"
  | "replay-last-sound"
  | "replay-recent"
  | "unknown";

export interface ParsedVoiceIntent {
  intent: VoiceIntent;
  symbol?: string;
  stockName?: string;
  mode?: ListeningMode;
  speed?: ListeningSpeed;
  includeVolume?: boolean;
  thresholdRate?: number | null;
  speechDetailLevel?: SpeechDetailLevel;
  replayWindowSeconds?: number;
  confidence: number;
  requiresConfirmation: boolean;
  conflict?: "include-volume";
}

const normalize = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, "");

const includesAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

const parseThresholdRate = (utterance: string): number | null => {
  const normalized = normalize(utterance).replace(/퍼센트/g, "%").replace(/프로/g, "%");
  const match = normalized.match(/(\d+(?:\.\d+)?)%/);

  return match ? Number(match[1]) : null;
};

// "최근 1분을 들려줘" / "지난 30초 다시 재생" 같은 구간 재생 요청에서 초 단위를 뽑아낸다.
const parseReplayWindowSeconds = (normalized: string): number | null => {
  const minuteMatch = normalized.match(/(\d+)분/);

  if (minuteMatch) {
    return Number(minuteMatch[1]) * 60;
  }

  const secondMatch = normalized.match(/(\d+)초/);

  if (secondMatch) {
    return Number(secondMatch[1]);
  }

  return null;
};

const parseMode = (normalized: string): ListeningMode | undefined => {
  if (includesAny(normalized, ["큰변화", "많이움직", "급등락", "알림만", "변화가클때"])) {
    return "alerts-only";
  }

  if (includesAny(normalized, ["거래량도", "거래량포함", "거래량같이", "가격과거래량", "전체", "함께"])) {
    return "price-volume";
  }

  if (
    includesAny(normalized, [
      "가격변화",
      "가격중심",
      "가격만",
      "현재가만",
      "등락률",
      "변동률",
      "거래량빼",
      "거래량제외"
    ])
  ) {
    return "price-only";
  }

  return undefined;
};

const parseSpeed = (normalized: string): ListeningSpeed | undefined => {
  if (includesAny(normalized, ["천천히", "느리게", "느린"])) {
    return "slow";
  }

  if (includesAny(normalized, ["빠르게", "빨리", "빠른"])) {
    return "fast";
  }

  if (includesAny(normalized, ["보통", "기본속도"])) {
    return "normal";
  }

  return undefined;
};

const parseSpeechDetail = (normalized: string): SpeechDetailLevel | undefined => {
  if (includesAny(normalized, ["자세히", "상세히", "설명많이"])) {
    return "high";
  }

  if (includesAny(normalized, ["짧게", "간단히", "설명줄여", "소리만"])) {
    return "low";
  }

  return undefined;
};

export const parseNaturalVoiceIntent = (utterance: string): ParsedVoiceIntent => {
  const normalized = normalize(utterance);
  const stock = findStockByUtterance(utterance);
  const mode = parseMode(normalized);
  const speed = parseSpeed(normalized);
  const speechDetailLevel = parseSpeechDetail(normalized);
  const thresholdRate = parseThresholdRate(utterance);
  const excludesVolume = includesAny(normalized, ["거래량빼", "거래량은빼", "거래량제외"]);
  const includesVolume = includesAny(normalized, ["거래량도", "거래량포함", "거래량같이", "가격과거래량", "전체"]);
  const hasVolumeConflict = excludesVolume && includesVolume;
  const ambiguousSamsung = stock?.symbol === "005930" && normalized.includes("삼성") && !normalized.includes("삼성전자") && !normalized.includes("삼전");
  const includeVolume = excludesVolume
    ? false
    : includesVolume
      ? true
      : undefined;
  const confidence = ambiguousSamsung ? 0.58 : stock ? 0.92 : normalized.length < 2 ? 0.2 : 0.74;
  const requiresConfirmation = ambiguousSamsung || confidence < 0.6;

  const withBase = (intent: VoiceIntent): ParsedVoiceIntent => {
    const parsed: ParsedVoiceIntent = { intent, confidence, requiresConfirmation };

    if (stock) {
      parsed.symbol = stock.symbol;
      parsed.stockName = stock.name;
    }

    if (mode) {
      parsed.mode = mode;
    }

    if (speed) {
      parsed.speed = speed;
    }

    if (includeVolume !== undefined) {
      parsed.includeVolume = includeVolume;
    }

    if (thresholdRate !== null) {
      parsed.thresholdRate = thresholdRate;
    }

    if (speechDetailLevel) {
      parsed.speechDetailLevel = speechDetailLevel;
    }

    if (hasVolumeConflict) {
      parsed.conflict = "include-volume";
    }

    return parsed;
  };

  if (includesAny(normalized, ["방금무슨소리", "방금소리", "왜소리", "소리이유", "무슨뜻"])) {
    return withBase("explain-last-sound");
  }

  const replayWindowSeconds = parseReplayWindowSeconds(normalized);

  if (replayWindowSeconds !== null && includesAny(normalized, ["들려줘", "재생", "다시"])) {
    const parsed = withBase("replay-recent");
    parsed.replayWindowSeconds = replayWindowSeconds;
    return parsed;
  }

  if (normalized.includes("다시") && includesAny(normalized, ["들려줘", "재생"])) {
    return withBase("replay-last-sound");
  }

  if (
    includesAny(normalized, ["소리로", "소리화"]) &&
    includesAny(normalized, ["현재가", "가격", "등락률", "변동률", "거래량", "체결량"])
  ) {
    return withBase(stock ? "select-stock" : "set-preferences");
  }

  if (includesAny(normalized, ["현재가", "가격알려", "얼마야"])) {
    return withBase("read-price");
  }

  if (includesAny(normalized, ["등락률", "변동률", "몇퍼센트"])) {
    return withBase("read-change-rate");
  }

  if (mode || speed || includeVolume !== undefined || thresholdRate !== null || speechDetailLevel) {
    if (stock && includesAny(normalized, ["들려줘", "소리로", "시작", "재생"])) {
      return withBase("select-stock");
    }

    return withBase("set-preferences");
  }

  if (includesAny(normalized, ["거래량", "체결량"])) {
    return withBase("read-volume");
  }

  if (includesAny(normalized, ["소리중지", "소리멈춰", "정지", "그만", "다멈춰", "전부멈춰", "모두멈춰"])) {
    return withBase("stop-sonification");
  }

  if (includesAny(normalized, ["들려줘", "소리로", "시작", "재생"])) {
    return withBase(stock ? "select-stock" : "start-sonification");
  }

  if (stock) {
    return withBase("select-stock");
  }

  return { intent: "unknown", confidence: 0.2, requiresConfirmation: true };
};

export interface SonificationPlanContext {
  currentSymbol: string;
  currentStockName: string;
  currentPreferences: ListeningPreferences;
}

const metricsFor = (
  mode: ListeningMode | undefined,
  includeVolume: boolean | undefined,
  fallbackIncludeVolume: boolean
): SonificationMetric[] => {
  const resolvedIncludeVolume = includeVolume ?? (mode ? mode === "price-volume" : fallbackIncludeVolume);

  return resolvedIncludeVolume ? ["price", "volume"] : ["price"];
};

/**
 * 자유질의 → AI 의도 해석(parseNaturalVoiceIntent) 다음 단계.
 * "답변 문장"이 아니라 기존 소리화 엔진에 그대로 넘길 수 있는 실행 계획을 만든다.
 * 정보 질의(현재가/등락률 등)처럼 답변이 필요한 의도는 null을 반환해서,
 * 호출부가 기존 TTS 답변 경로로 넘어가도록 한다.
 */
export const buildSonificationPlan = (
  parsed: ParsedVoiceIntent,
  context: SonificationPlanContext
): SonificationPlan | null => {
  const symbol = parsed.symbol ?? context.currentSymbol;
  const stockName = parsed.stockName ?? context.currentStockName;

  if (parsed.intent === "select-stock" || parsed.intent === "start-sonification") {
    // 모드를 말하지 않았다면 되묻지 않고 현재(또는 기본) 청취 모드로 바로 재생한다.
    const mode = parsed.mode ?? context.currentPreferences.mode;

    return {
      action: "START_REALTIME",
      symbol,
      stockName,
      metrics: metricsFor(mode, parsed.includeVolume, context.currentPreferences.includeVolume),
      timeRange: "realtime",
      mode,
      thresholdRate: mode === "alerts-only" ? (parsed.thresholdRate ?? context.currentPreferences.thresholdRate ?? 1) : null
    };
  }

  if (parsed.intent === "stop-sonification") {
    return { action: "STOP", symbol, stockName, metrics: [], timeRange: "realtime" };
  }

  if (parsed.intent === "replay-last-sound") {
    return { action: "REPLAY_LAST", symbol, stockName, metrics: ["price", "volume"], timeRange: "last-event" };
  }

  if (parsed.intent === "replay-recent") {
    const seconds = parsed.replayWindowSeconds ?? 60;

    return {
      action: "REPLAY_RECENT",
      symbol,
      stockName,
      metrics: ["price", "volume"],
      timeRange: `${seconds}s`
    };
  }

  return null;
};
