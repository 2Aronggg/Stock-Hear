import { useState } from "react";
import { listenOnce, speak } from "../audio/speech";
import { buildSonificationPlan, parseNaturalVoiceIntent } from "../audio/voiceIntent";
import type {
  ListeningMode,
  ListeningPreferences,
  RealtimeTrade,
  SonificationPlan,
  SoundEventLog
} from "../types";
import { getStockName } from "./StockSelector";

interface VoiceControlsProps {
  currentSymbol: string;
  preferences: ListeningPreferences;
  trade: RealtimeTrade | null;
  lastSoundEvent: SoundEventLog | null;
  volume: number;
  onPreferencesChange: (preferences: ListeningPreferences) => void;
  onPlayCurrentTrade: (preferences: ListeningPreferences) => boolean;
  onReplayLast: () => boolean;
  onReplayRecent: (windowSeconds: number) => boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  onSymbolChange: (symbol: string) => void;
  onVolumeChange: (volume: number) => void;
}

interface PendingQuestion {
  type: "mode" | "confirm-stock";
  symbol: string;
  stockName: string;
  mode?: ListeningMode;
  thresholdRate?: number | null;
}

const modeLabel: Record<ListeningMode, string> = {
  "price-only": "가격 변화 중심",
  "price-volume": "가격과 거래량 함께",
  "alerts-only": "큰 변화 알림"
};

const explainSoundEvent = (event: SoundEventLog): string => {
  const direction =
    event.soundEvent === "PRICE_UP"
      ? "상승"
      : event.soundEvent === "PRICE_DOWN"
        ? "하락"
        : "보합";
  const volumeText =
    event.mapping.volume === "tradeVolume"
      ? `세기는 체결량 ${event.sourceData.tradeVolume.toLocaleString("ko-KR")}주입니다.`
      : "거래량은 제외했습니다.";

  return `${event.stockName} ${direction}. ${event.sourceData.changeRate.toFixed(2)}퍼센트. ${volumeText}`;
};

const buildPreferenceSummary = (preferences: ListeningPreferences): string => {
  const speedText =
    preferences.speed === "slow"
      ? "천천히"
      : preferences.speed === "fast"
        ? "빠르게"
        : "보통 속도로";
  const volumeText = preferences.includeVolume ? "거래량 소리를 포함해서" : "거래량 소리는 제외하고";
  const thresholdText =
    preferences.mode === "alerts-only" && preferences.thresholdRate !== null
      ? `, ${preferences.thresholdRate}퍼센트 이상`
      : "";

  return `${modeLabel[preferences.mode]}, ${volumeText}, ${speedText}${thresholdText}`;
};

const normalizeCommand = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, "");

const wantsSoundOutput = (normalized: string): boolean =>
  (normalized.includes("소리로") || normalized.includes("들려줘") || normalized.includes("소리화")) &&
  (normalized.includes("등락률") ||
    normalized.includes("변동률") ||
    normalized.includes("가격") ||
    normalized.includes("현재가") ||
    normalized.includes("거래량") ||
    normalized.includes("체결량"));

const isAffirmative = (normalized: string): boolean =>
  normalized.includes("응") || normalized.includes("맞아") || normalized.includes("네") || normalized.includes("예");

const isNegative = (normalized: string): boolean =>
  normalized.includes("아니") || normalized.includes("틀려") || normalized.includes("아냐");

export const VoiceControls = ({
  currentSymbol,
  preferences,
  trade,
  lastSoundEvent,
  volume,
  onPreferencesChange,
  onPlayCurrentTrade,
  onReplayLast,
  onReplayRecent,
  onSoundEnabledChange,
  onSymbolChange,
  onVolumeChange
}: VoiceControlsProps) => {
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [lastTranscript, setLastTranscript] = useState("아직 인식된 문장이 없습니다.");
  const [assistantMessage, setAssistantMessage] = useState(
    "예: 삼성전자 들려줘"
  );

  const speakAndShow = (message: string): void => {
    setAssistantMessage(message);
    speak(message);
  };

  const showOnly = (message: string): void => {
    setAssistantMessage(message);
  };

  const applyPreferences = (nextPreferences: Partial<ListeningPreferences>): ListeningPreferences => {
    const updated = { ...preferences, ...nextPreferences };
    onPreferencesChange(updated);
    return updated;
  };

  const startSession = (symbol: string, stockName: string, mode: ListeningMode, thresholdRate?: number | null): void => {
    onSymbolChange(symbol);
    const updated = applyPreferences({
      mode,
      includeVolume: mode === "price-volume",
      thresholdRate: mode === "alerts-only" ? thresholdRate ?? 1 : null
    });

    onSoundEnabledChange(true);
    setPendingQuestion(null);
    showOnly(`${stockName} 소리화 시작.`);
  };

  // AI가 만든 SonificationPlan을 그대로 기존 엔진(startSession/onReplayLast/onReplayRecent)에
  // 넘기는 실행부. 소리 자체는 언제나 기존 엔진 규칙이 만들고, AI는 "무엇을 재생할지"만 고른다.
  const executeSonificationPlan = (plan: SonificationPlan): void => {
    if (plan.action === "START_REALTIME") {
      if (plan.mode) {
        startSession(plan.symbol, plan.stockName, plan.mode, plan.thresholdRate);
        return;
      }

      onSoundEnabledChange(true);
      showOnly(`${plan.stockName} 소리화 시작.`);
      return;
    }

    if (plan.action === "REPLAY_LAST") {
      const replayed = onReplayLast();
      showOnly(replayed ? `${plan.stockName} 방금 체결 다시 재생.` : "재생할 최근 소리가 없습니다.");
      return;
    }

    if (plan.action === "REPLAY_RECENT") {
      const seconds = Number(plan.timeRange.replace("s", "")) || 60;
      const requested = onReplayRecent(seconds);
      showOnly(
        requested
          ? `${plan.stockName} 최근 ${seconds}초 구간 재생을 요청했습니다.`
          : "서버 연결 후 다시 요청해 주세요."
      );
    }
  };

  const handlePendingAnswer = (transcript: string): boolean => {
    if (!pendingQuestion) {
      return false;
    }

    const parsed = parseNaturalVoiceIntent(transcript);
    const normalized = normalizeCommand(transcript);

    if (pendingQuestion.type === "confirm-stock") {
      if (isNegative(normalized)) {
        setPendingQuestion(null);
        speakAndShow("종목명을 다시 말씀해 주세요.");
        return true;
      }

      if (!isAffirmative(normalized)) {
        speakAndShow(`${pendingQuestion.stockName} 맞나요?`);
        return true;
      }

      if (pendingQuestion.mode) {
        startSession(
          pendingQuestion.symbol,
          pendingQuestion.stockName,
          pendingQuestion.mode,
          pendingQuestion.thresholdRate
        );
        return true;
      }

      onSymbolChange(pendingQuestion.symbol);
      setPendingQuestion({
        type: "mode",
        symbol: pendingQuestion.symbol,
        stockName: pendingQuestion.stockName
      });
      speakAndShow(`${pendingQuestion.stockName}. 가격, 거래량, 큰 변화 중 선택.`);
      return true;
    }

    const mode = parsed.mode;

    if (!mode) {
      speakAndShow("가격, 거래량 포함, 큰 변화 중 선택해 주세요.");
      return true;
    }

    startSession(pendingQuestion.symbol, pendingQuestion.stockName, mode, parsed.thresholdRate);
    return true;
  };

  const handleCommand = (transcript: string): void => {
    setLastTranscript(transcript || "인식된 문장이 비어 있습니다.");

    if (handlePendingAnswer(transcript)) {
      return;
    }

    const parsed = parseNaturalVoiceIntent(transcript);
    const normalized = normalizeCommand(transcript);
    const targetSymbol = parsed.symbol ?? currentSymbol;
    const targetStockName = parsed.stockName ?? getStockName(targetSymbol);

    if (parsed.conflict === "include-volume") {
      speakAndShow("거래량 포함 여부를 다시 말씀해 주세요.");
      return;
    }

    if (parsed.requiresConfirmation && parsed.symbol) {
      const confirmation: PendingQuestion = {
        type: "confirm-stock",
        symbol: parsed.symbol,
        stockName: targetStockName
      };

      if (parsed.mode) {
        confirmation.mode = parsed.mode;
      }

      if (parsed.thresholdRate !== undefined) {
        confirmation.thresholdRate = parsed.thresholdRate;
      }

      setPendingQuestion(confirmation);
      speakAndShow(`${targetStockName} 맞나요?`);
      return;
    }

    if (normalized.includes("소리크게") || normalized.includes("볼륨올려")) {
      const nextVolume = Math.min(0.4, volume + 0.05);
      onVolumeChange(nextVolume);
      showOnly(`볼륨 ${Math.round(nextVolume * 250)}퍼센트.`);
      return;
    }

    if (normalized.includes("소리작게") || normalized.includes("볼륨낮춰") || normalized.includes("볼륨줄여")) {
      const nextVolume = Math.max(0, volume - 0.05);
      onVolumeChange(nextVolume);
      showOnly(`볼륨 ${Math.round(nextVolume * 250)}퍼센트.`);
      return;
    }

    if (wantsSoundOutput(normalized)) {
      const mode: ListeningMode =
        normalized.includes("거래량") || normalized.includes("체결량")
          ? "price-volume"
          : "price-only";
      const updated = applyPreferences({
        mode,
        includeVolume: mode === "price-volume",
        thresholdRate: null
      });

      if (parsed.symbol && parsed.symbol !== currentSymbol) {
        onSymbolChange(parsed.symbol);
        onSoundEnabledChange(true);
        showOnly(`${targetStockName} 소리화 대기.`);
        return;
      }

      onSoundEnabledChange(true);
      const played = onPlayCurrentTrade(updated);
      showOnly(played ? `${targetStockName} 소리화.` : `${targetStockName} 소리화 대기.`);
      return;
    }

    // 자유질의 → 의도 해석 → SonificationPlan → 기존 소리화 엔진 실행.
    // "지금 재생할 것"을 고르는 의도(실시간 시작/재생)만 여기서 처리하고,
    // 정보 질의(현재가/등락률 등)는 plan이 null이라 아래 답변 경로로 그대로 넘어간다.
    const plan = buildSonificationPlan(parsed, {
      currentSymbol,
      currentStockName: getStockName(currentSymbol),
      currentPreferences: preferences
    });

    if (plan && plan.action !== "STOP") {
      executeSonificationPlan(plan);
      return;
    }

    if (parsed.intent === "explain-last-sound") {
      speakAndShow(lastSoundEvent ? explainSoundEvent(lastSoundEvent) : "아직 소리 기록이 없습니다.");
      return;
    }

    if (parsed.intent === "read-price") {
      if (parsed.symbol && parsed.symbol !== currentSymbol) {
        onSymbolChange(parsed.symbol);
      }
      speakAndShow(
        trade && targetSymbol === currentSymbol
        ? `${targetStockName} ${trade.currentPrice.toLocaleString("ko-KR")}원.`
          : `${targetStockName} 수신 대기 중.`
      );
      return;
    }

    if (parsed.intent === "read-change-rate") {
      speakAndShow(
        trade
          ? `${getStockName(currentSymbol)} ${trade.changeRate.toFixed(2)}퍼센트.`
          : "등락률 수신 대기 중."
      );
      return;
    }

    if (parsed.intent === "read-volume") {
      speakAndShow(
        trade
          ? `${getStockName(currentSymbol)} ${trade.tradeVolume.toLocaleString("ko-KR")}주.`
          : "체결량 수신 대기 중."
      );
      return;
    }

    if (parsed.intent === "stop-sonification") {
      onSoundEnabledChange(false);
      if (normalized.includes("다멈춰") || normalized.includes("전부멈춰") || normalized.includes("모두멈춰")) {
        speakAndShow("모두 중지했습니다.");
        return;
      }
      showOnly("소리화 중지.");
      return;
    }

    if (parsed.intent === "set-preferences") {
      const updated = applyPreferences({
        mode: parsed.mode ?? preferences.mode,
        speed: parsed.speed ?? preferences.speed,
        includeVolume: parsed.includeVolume ?? preferences.includeVolume,
        thresholdRate: parsed.thresholdRate ?? preferences.thresholdRate,
        speechDetailLevel: parsed.speechDetailLevel ?? preferences.speechDetailLevel
      });

      showOnly(`설정 적용. ${buildPreferenceSummary(updated)}.`);
      return;
    }

    speakAndShow("정확히 듣지 못했습니다. 다시 말씀해 주세요.");
  };

  const startListening = (): void => {
    const supported = listenOnce(handleCommand, () => undefined);

    if (!supported) {
      speakAndShow("이 브라우저는 음성 인식을 지원하지 않습니다.");
    }
  };

  return (
    <section className="panel voice-controls" aria-labelledby="voice-controls-title">
      <div className="panel-heading">
        <span className="panel-kicker">STEP 03</span>
        <h2 id="voice-controls-title">AI 음성 대화</h2>
      </div>
      <div className="voice-assistant-shell">
        <div className="voice-orb" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <button className="voice-button" type="button" onClick={startListening}>
          누르고 말하기
        </button>
        <div className="conversation-panel" aria-live="polite">
          <div className="message-card message-user">
            <span>인식 문장</span>
            <p>{lastTranscript}</p>
          </div>
          <div className="message-card message-ai">
            <span>AI 안내</span>
            <p>{assistantMessage}</p>
          </div>
        </div>
      </div>
      <dl className="preference-summary">
        <div>
          <dt>청취 모드</dt>
          <dd>{modeLabel[preferences.mode]}</dd>
        </div>
        <div>
          <dt>속도</dt>
          <dd>{preferences.speed}</dd>
        </div>
        <div>
          <dt>거래량</dt>
          <dd>{preferences.includeVolume ? "포함" : "제외"}</dd>
        </div>
        <div>
          <dt>볼륨</dt>
          <dd>{Math.round(volume * 250)}%</dd>
        </div>
      </dl>
      <div className="quick-command-row" aria-label="데모 음성 명령 예시">
        {["삼성전자 들려줘", "급등주 거래량도 같이", "천천히 들려줘", "방금 무슨 소리였어"].map((command) => (
          <button className="text-command" type="button" key={command} onClick={() => handleCommand(command)}>
            {command}
          </button>
        ))}
      </div>
    </section>
  );
};
