import type {
  ConnectionStatus,
  DataMode,
  ReplayStatus,
  RealtimeTrade
} from "../types";

interface MarketDisplayProps {
  status: ConnectionStatus;
  trade: RealtimeTrade | null;
  dataMode: DataMode;
  replayStatus: ReplayStatus;
  onReplayRequest: (windowSeconds: 60 | 180 | 300) => void;
}

const statusLabel: Record<ConnectionStatus, string> = {
  connecting: "서버 연결 중",
  connected: "실시간 연결됨",
  disconnected: "서버 연결 안 됨",
  error: "서버 연결 오류"
};

const statusDescription: Record<ConnectionStatus, string> = {
  connecting: "실시간 체결 서버에 연결하고 있습니다.",
  connected: "선택한 종목의 체결 데이터를 수신하고 있습니다.",
  disconnected: "백엔드 서버를 실행하면 실시간 데이터가 표시됩니다.",
  error: "연결에 실패했습니다. 서버 상태와 웹소켓 주소를 확인해 주세요."
};

const formatSignedRate = (rate: number): string =>
  `${rate > 0 ? "+" : ""}${rate.toFixed(2)}%`;

const formatPrice = (price: number, currency: "KRW" | "USD"): string =>
  new Intl.NumberFormat(currency === "KRW" ? "ko-KR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2
  }).format(price);

const formatSignedPrice = (
  price: number,
  currency: "KRW" | "USD"
): string => `${price > 0 ? "+" : ""}${formatPrice(price, currency)}`;

export const MarketDisplay = ({
  status,
  trade,
  dataMode,
  replayStatus,
  onReplayRequest
}: MarketDisplayProps) => {
  const trendClass = trade
    ? trade.changeRate > 0
      ? "up"
      : trade.changeRate < 0
        ? "down"
        : "flat"
    : "flat";

  return (
    <section className={`market-feature ${trendClass}`} aria-labelledby="market-display-title">
      <div className="market-feature-copy">
        <span className="panel-kicker">
          {dataMode === "live"
            ? "LIVE DATA FROM 한국투자증권 API"
            : dataMode === "replay"
              ? "RECENT LIVE DATA"
              : "SAVED MARKET DATA"}
        </span>
        <h2 id="market-display-title">
          {dataMode === "live"
            ? "실시간 체결 정보"
            : dataMode === "replay"
              ? "최근 체결 다시 듣기"
              : "저장 데이터 재생"}
        </h2>
        <div className="status-block">
          <p className={`status-badge ${status}`}>
            <span className="status-dot" aria-hidden="true" />
            {statusLabel[status]}
          </p>
          <p>
            {dataMode === "demo"
              ? "저장된 실제 체결 데이터를 시간 순서대로 재생합니다."
              : dataMode === "replay"
                ? "방금 수신한 실제 체결 데이터를 시간 순서대로 재생합니다."
                : statusDescription[status]}
          </p>
          <p className={`data-mode-label ${dataMode}`}>
            {replayStatus === "error"
              ? "Demo Replay 오류"
              : dataMode === "live"
                ? "실시간 모드"
                : dataMode === "replay"
                  ? replayStatus === "completed"
                    ? "Replay 완료"
                    : "Replay 재생 중"
                : replayStatus === "playing"
                ? "Demo Replay 재생 중"
                : replayStatus === "completed"
                  ? "Demo Replay 완료"
                  : "Demo Replay"}
          </p>
        </div>
        <div className="replay-controls" aria-label="저장 데이터 다시 듣기">
          {[60, 180, 300].map((seconds) => (
            <button
              className="text-command"
              type="button"
              key={seconds}
              disabled={status !== "connected"}
              onClick={() => onReplayRequest(seconds as 60 | 180 | 300)}
            >
              {seconds / 60}분 재생
            </button>
          ))}
        </div>
      </div>

      {trade ? (
        <div className="market-feature-data">
          <div className={`price-card ${trendClass}`} key={`${trade.symbol}-${trade.currentPrice}-${trade.tradeTime}`}>
            <span className="price-label">현재가</span>
            <strong>{formatPrice(trade.currentPrice, trade.currency)}</strong>
            <span>
              {formatSignedRate(trade.changeRate)} · {formatSignedPrice(trade.changePrice, trade.currency)}
            </span>
          </div>
          <dl className="market-values">
            <div>
              <dt>체결량</dt>
              <dd>{trade.tradeVolume.toLocaleString("ko-KR")}주</dd>
            </div>
            <div>
              <dt>누적 거래량</dt>
              <dd>{trade.accumulatedVolume.toLocaleString("ko-KR")}주</dd>
            </div>
            <div>
              <dt>마지막 체결 시간</dt>
              <dd>{trade.tradeTime}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="empty-state">
          <strong>수신 대기 중</strong>
          <span>종목을 선택하거나 음성으로 청취 세션을 시작하면 체결 정보가 여기에 표시됩니다.</span>
        </div>
      )}
    </section>
  );
};
