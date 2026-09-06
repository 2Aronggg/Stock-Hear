export interface MarketTrade {
  market: "KR" | "US";
  exchange: string;
  symbol: string;
  stockName: string;
  currency: "KRW" | "USD";
  tradeTime: string;
  currentPrice: number;
  changePrice: number;
  changeRate: number;
  tradeVolume: number;
  accumulatedVolume: number;

  receivedAt: string;
}

export type RealtimeTrade = MarketTrade;

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export type DataMode = "live" | "replay" | "demo";

export type ReplayStatus = "idle" | "playing" | "completed" | "error";

export type ListeningMode = "price-only" | "price-volume" | "alerts-only";

export type ListeningSpeed = "slow" | "normal" | "fast";

export type SpeechDetailLevel = "low" | "medium" | "high";

export interface ListeningPreferences {
  mode: ListeningMode;
  speed: ListeningSpeed;
  includeVolume: boolean;
  thresholdRate: number | null;
  speechDetailLevel: SpeechDetailLevel;
}

export type SonificationAction = "START_REALTIME" | "STOP" | "REPLAY_LAST" | "REPLAY_RECENT" | "COMPARE";

export type SonificationMetric = "price" | "volume";

// AI가 자유질의를 해석한 결과. 문장으로 답하는 대신, 기존 소리화 엔진에
// 그대로 넘길 수 있는 실행 계획을 만든다. 소리 자체(음높이/음량/길이)는
// 이 계획이 아니라 언제나 Sonification 엔진(sonification.ts)이 결정한다.
export interface SonificationPlan {
  action: SonificationAction;
  symbol: string;
  stockName: string;
  metrics: SonificationMetric[];
  timeRange: string; // "realtime" | "last-event" | "60s" 등
  mode?: ListeningMode | undefined;
  thresholdRate?: number | null;
}

export interface SoundEventLog {
  soundEvent: "PRICE_UP" | "PRICE_DOWN" | "PRICE_FLAT";
  symbol: string;
  stockName: string;
  createdAt: string;
  sourceData: {
    currentPrice: number;
    changePrice: number;
    changeRate: number;
    tradeVolume: number;
  };
  mapping: {
    pitch: "priceDirection";
    volume: "tradeVolume" | "fixed";
    tempo: ListeningSpeed;
  };
}

export type ClientSocketMessage =
  | { type: "subscribe"; symbol: string }
  | { type: "unsubscribe"; symbol: string }
  | { type: "replay"; symbol: string; windowSeconds: 60 | 180 | 300 }
  | { type: "ping" };

export type ServerSocketMessage =
  | { type: "connected"; receivedAt: string }
  | { type: "subscribed"; symbol: string; receivedAt: string }
  | { type: "unsubscribed"; symbol: string; receivedAt: string }
  | { type: "trade"; trade: RealtimeTrade; dataMode: DataMode }
  | {
      type: "replay_started";
      symbol: string;
      windowSeconds: 60 | 180 | 300;
      tradeCount: number;
      sourceTradeCount: number;
      dataMode: "replay" | "demo";
      receivedAt: string;
    }
  | {
      type: "replay_completed";
      symbol: string;
      dataMode: "replay" | "demo";
      receivedAt: string;
    }
  | { type: "error"; message: string; receivedAt: string }
  | { type: "pong"; receivedAt: string };

