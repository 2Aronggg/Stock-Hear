import { useEffect, useMemo, useRef, useState } from "react";
import { MarketSocket } from "./api/marketSocket";
import { Sonification } from "./audio/sonification";
import { AudioControls } from "./components/AudioControls";
import { MarketDisplay } from "./components/MarketDisplay";
import { getStockName, isSupportedSymbol, StockSelector } from "./components/StockSelector";
import { VoiceControls } from "./components/VoiceControls";
import type {
  ConnectionStatus,
  DataMode,
  ListeningPreferences,
  RealtimeTrade,
  ReplayStatus,
  ServerSocketMessage,
  SoundEventLog
} from "./types";

const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL ?? "ws://localhost:4000/ws";

const selectedSymbolStorageKey = "stock-hear:selected-symbol";
const defaultSymbol = "005930";
const soundEnabledStorageKey = "stock-hear:sound-enabled";

const defaultPreferences: ListeningPreferences = {
  mode: "price-volume",
  speed: "normal",
  includeVolume: true,
  thresholdRate: null,
  speechDetailLevel: "medium"
};

const getInitialSymbol = (): string => {
  const savedSymbol = window.localStorage.getItem(selectedSymbolStorageKey);

  return savedSymbol && isSupportedSymbol(savedSymbol)
    ? savedSymbol
    : defaultSymbol;
};

const getInitialSoundEnabled = (): boolean =>
  window.localStorage.getItem(soundEnabledStorageKey) === "true";

const iconBadges = [
  {
    label: "음성 명령 입력",
    className: "badge-mic",
    path: "M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0m-6 6v3m-4 0h8"
  },
  {
    label: "소리 안내",
    className: "badge-speaker",
    path: "M5 9v6h4l5 4V5L9 9H5Zm12 1a4 4 0 0 1 0 4m2-7a8 8 0 0 1 0 10"
  },
  {
    label: "실시간 체결가",
    className: "badge-chart",
    path: "M4 18h16M6 15l3-4 3 2 5-7m0 0h-4m4 0v4"
  },
  {
    label: "급등 급락 알림",
    className: "badge-bell",
    path: "M18 16H6l1.5-2V10a4.5 4.5 0 0 1 9 0v4L18 16Zm-8 3h4"
  },
  {
    label: "청취 모드",
    className: "badge-headphone",
    path: "M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v-6h4M4 13v4a2 2 0 0 0 2 2h2v-6H4"
  }
];

export const App = () => {
  const [symbol, setSymbol] = useState(getInitialSymbol);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [dataMode, setDataMode] = useState<DataMode>("live");
  const [replayStatus, setReplayStatus] = useState<ReplayStatus>("idle");
  const [latestTrade, setLatestTrade] = useState<RealtimeTrade | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(getInitialSoundEnabled);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.15);
  const [preferences, setPreferences] = useState<ListeningPreferences>(defaultPreferences);
  const [lastSoundEvent, setLastSoundEvent] = useState<SoundEventLog | null>(null);
  const sonification = useMemo(() => new Sonification(), []);
  const socketRef = useRef<MarketSocket | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    sonification.setMuted(muted || !soundEnabled);
    sonification.setVolume(volume);
    sonification.setPreferences(preferences);
  }, [muted, preferences, sonification, soundEnabled, volume]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const socket = new MarketSocket({
      url: websocketUrl,
      symbol,
      onStatusChange: setStatus,
      onMessage: (message: ServerSocketMessage) => {
        if (message.type === "replay_started") {
          setDataMode("demo");
          setReplayStatus("playing");
          setLatestTrade(null);
          soundEnabledRef.current = true;
          setSoundEnabled(true);
          window.localStorage.setItem(soundEnabledStorageKey, "true");
          return;
        }

        if (message.type === "replay_completed") {
          setReplayStatus("completed");
          return;
        }

        if (message.type === "error") {
          setReplayStatus("error");
          return;
        }

        if (message.type === "trade") {
          setLatestTrade(message.trade);
          setDataMode(message.dataMode);

          if (message.dataMode === "live") {
            setReplayStatus("idle");
          }

          if (soundEnabledRef.current) {
            const soundEvent = sonification.playTrade(message.trade, getStockName(symbol));
            if (soundEvent) {
              setLastSoundEvent(soundEvent);
            }
          }
        }
      }
    });

    socketRef.current = socket;
    socket.connect();
    return () => socket.disconnect();
  }, [sonification, symbol]);

  const handleSymbolChange = (nextSymbol: string): void => {
    if (nextSymbol === symbol || !isSupportedSymbol(nextSymbol)) {
      return;
    }

    window.localStorage.setItem(selectedSymbolStorageKey, nextSymbol);
    setLatestTrade(null);
    setDataMode("live");
    setReplayStatus("idle");
    setSymbol(nextSymbol);
  };

  const handleSoundEnabledChange = (enabled: boolean): void => {
    window.localStorage.setItem(soundEnabledStorageKey, String(enabled));

    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
  };

  const handlePreferencesChange = (nextPreferences: ListeningPreferences): void => {
    sonification.setPreferences(nextPreferences);
    setPreferences(nextPreferences);
  };

  const handlePlayCurrentTrade = (nextPreferences: ListeningPreferences): boolean => {
    if (!latestTrade) {
      return false;
    }

    sonification.setPreferences(nextPreferences);
    const soundEvent = sonification.playTrade(latestTrade, getStockName(symbol));

    if (soundEvent) {
      setLastSoundEvent(soundEvent);
    }

    return Boolean(soundEvent);
  };

  // "방금 움직임 다시 들려줘" — 가장 최근 소리 이벤트를 그대로 다시 재생한다.
  // AI는 무엇을 재생할지만 고르고, 소리 자체는 항상 기존 엔진(sonification)이 만든다.
  const handleReplayLast = (): boolean => {
    if (!lastSoundEvent) {
      return false;
    }

    const syntheticTrade: RealtimeTrade = {
      market: latestTrade?.market ?? "KR",
      exchange: latestTrade?.exchange ?? "DEMO",
      symbol: lastSoundEvent.symbol,
      stockName: lastSoundEvent.stockName,
      currency: latestTrade?.currency ?? "KRW",
      tradeTime: latestTrade?.tradeTime ?? "",
      currentPrice: lastSoundEvent.sourceData.currentPrice,
      changePrice: lastSoundEvent.sourceData.changePrice,
      changeRate: lastSoundEvent.sourceData.changeRate,
      tradeVolume: lastSoundEvent.sourceData.tradeVolume,
      accumulatedVolume: latestTrade?.accumulatedVolume ?? 0,
      receivedAt: new Date().toISOString()
    };

    const soundEvent = sonification.playTrade(syntheticTrade, lastSoundEvent.stockName);

    if (soundEvent) {
      setLastSoundEvent(soundEvent);
    }

    return Boolean(soundEvent);
  };

  const handleReplayRecent = (windowSeconds: number): boolean => {
    if (
      windowSeconds !== 60 &&
      windowSeconds !== 180 &&
      windowSeconds !== 300
    ) {
      return false;
    }

    return socketRef.current?.replay(symbol, windowSeconds) ?? false;
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <div id="live-region" className="sr-only" aria-live="polite" aria-atomic="true">
        {replayStatus === "playing"
          ? "저장된 체결 데이터 재생을 시작했습니다."
          : replayStatus === "completed"
            ? "저장된 체결 데이터 재생이 완료되었습니다."
            : replayStatus === "error"
              ? "저장된 체결 데이터를 재생할 수 없습니다."
              : status === "connected"
                ? "서버에 연결되었습니다."
                : status === "error"
                  ? "서버 연결에 실패했습니다."
                  : status === "disconnected"
                    ? "서버 연결이 끊어졌습니다."
                    : ""}
      </div>
      <main id="main-content" className="page">
        <div className="shell">
          <header className="hero">
            <div className="hero-copy">
              <p className="eyebrow">시각 장애인을 위한</p>
              <h1>
                주식 정보를 <span>듣는</span> AI Stock - Hear
              </h1>
              <p>
                시각장애인이 화면을 보지 않고 음성으로 종목과 청취 조건을 설정하고, 실시간 체결
                흐름을 소리와 음성 안내로 직관적으로 확인할 수 있는 AI 기반 주식 접근성
                인터페이스입니다.
              </p>
            </div>
            <div className="hero-stage">
              <div className="floating-badges" aria-hidden="true">
                {iconBadges.map((badge) => (
                  <span className={`icon-badge ${badge.className}`} key={badge.label}>
                    <svg viewBox="0 0 24 24" role="img" aria-label={badge.label}>
                      <path d={badge.path} />
                    </svg>
                  </span>
                ))}
              </div>
              <div className="hero-status" aria-label="현재 선택 종목">
                <span>현재 청취 종목</span>
                <strong>{getStockName(symbol)}</strong>
                <small>{symbol}</small>
              </div>
            </div>
          </header>

          <MarketDisplay
            status={status}
            trade={latestTrade}
            dataMode={dataMode}
            replayStatus={replayStatus}
            onReplayRequest={handleReplayRecent}
          />

          <div className="grid grid-secondary">
            <StockSelector symbol={symbol} onSymbolChange={handleSymbolChange} />
            <AudioControls
              enabled={soundEnabled}
              muted={muted}
              volume={volume}
              onEnabledChange={handleSoundEnabledChange}
              onMutedChange={setMuted}
              onVolumeChange={setVolume}
              onSample={(direction) => sonification.playSample(direction)}
              onVolumeSample={(sampleVolume) => sonification.playSample("flat", sampleVolume)}
            />
            <VoiceControls
              currentSymbol={symbol}
              preferences={preferences}
              trade={latestTrade}
              lastSoundEvent={lastSoundEvent}
              volume={volume}
              onPreferencesChange={handlePreferencesChange}
              onPlayCurrentTrade={handlePlayCurrentTrade}
              onReplayLast={handleReplayLast}
              onReplayRecent={handleReplayRecent}
              onSoundEnabledChange={handleSoundEnabledChange}
              onSymbolChange={handleSymbolChange}
              onVolumeChange={setVolume}
            />
          </div>

          <footer className="app-footer">
            <span>prototype for Bitamin summer project</span>
            <span>AI는 주가 예측이 아니라 의도 이해와 접근성 제어에 사용됩니다.</span>
          </footer>
        </div>
      </main>
    </>
  );
};
