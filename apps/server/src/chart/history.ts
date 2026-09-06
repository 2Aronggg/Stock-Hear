import type { MarketTrade } from "../market/types.js";
import type { ReplaySample } from "../replay/sampleStore.js";

export type ChartRange = "5m" | "30m" | "1h";
export type ChartDataMode = "live" | "demo";
export type ChartTrend = "up" | "down" | "flat";

export interface ChartPoint {
  sequence: number;
  time: string;
  tradeTime: string;
  price: number;
  volume: number;
  changePrice: number;
  changeRate: number;
  accumulatedVolume: number;
  dataMode: ChartDataMode;
}

export interface ChartHistory {
  symbol: string;
  stockName: string | null;
  market: MarketTrade["market"] | null;
  exchange: string | null;
  currency: MarketTrade["currency"] | null;
  requestedRange: ChartRange;
  requestedRangeSeconds: number;
  dataMode: ChartDataMode;
  pointCount: number;
  sourcePointCount: number;
  points: ChartPoint[];
  summary: {
    latestPrice: number | null;
    latestChangePrice: number | null;
    latestChangeRate: number | null;
    totalVolume: number;
    minPrice: number | null;
    maxPrice: number | null;
    firstReceivedAt: string | null;
    lastReceivedAt: string | null;
    trend: ChartTrend;
  };
}

const chartRangeSeconds: Record<ChartRange, number> = {
  "5m": 5 * 60,
  "30m": 30 * 60,
  "1h": 60 * 60
};

const maxChartPoints = 600;

export const parseChartRange = (
  value: unknown
): ChartRange | null => {
  if (value === undefined) {
    return "5m";
  }

  if (value === "5m" || value === "30m" || value === "1h") {
    return value;
  }

  return null;
};

export const getChartRangeMs = (range: ChartRange): number =>
  chartRangeSeconds[range] * 1000;

export const buildChartHistory = (
  symbol: string,
  range: ChartRange,
  liveTrades: MarketTrade[],
  sample: ReplaySample | undefined
): ChartHistory => {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const dataMode: ChartDataMode =
    liveTrades.length > 0 ? "live" : "demo";
  const sourceTrades =
    dataMode === "live"
      ? liveTrades
      : sample
        ? selectRecentTrades(sample.trades, getChartRangeMs(range))
        : [];
  const chartTrades = downsampleTrades(sourceTrades, maxChartPoints);
  const points = chartTrades.map((trade, index) =>
    toChartPoint(trade, index, dataMode)
  );
  const latestTrade = chartTrades.at(-1) ?? null;
  const firstTrade = chartTrades[0] ?? null;
  const prices = chartTrades.map((trade) => trade.currentPrice);
  const trend = getTrend(firstTrade, latestTrade);

  return {
    symbol: normalizedSymbol,
    stockName: latestTrade?.stockName ?? sample?.trades[0]?.stockName ?? null,
    market: latestTrade?.market ?? sample?.market ?? null,
    exchange: latestTrade?.exchange ?? sample?.trades[0]?.exchange ?? null,
    currency: latestTrade?.currency ?? sample?.trades[0]?.currency ?? null,
    requestedRange: range,
    requestedRangeSeconds: chartRangeSeconds[range],
    dataMode,
    pointCount: points.length,
    sourcePointCount: sourceTrades.length,
    points,
    summary: {
      latestPrice: latestTrade?.currentPrice ?? null,
      latestChangePrice: latestTrade?.changePrice ?? null,
      latestChangeRate: latestTrade?.changeRate ?? null,
      totalVolume: chartTrades.reduce(
        (sum, trade) => sum + trade.tradeVolume,
        0
      ),
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      maxPrice: prices.length > 0 ? Math.max(...prices) : null,
      firstReceivedAt: firstTrade?.receivedAt ?? null,
      lastReceivedAt: latestTrade?.receivedAt ?? null,
      trend
    }
  };
};

const toChartPoint = (
  trade: MarketTrade,
  index: number,
  dataMode: ChartDataMode
): ChartPoint => ({
  sequence: index,
  time: trade.receivedAt,
  tradeTime: trade.tradeTime,
  price: trade.currentPrice,
  volume: trade.tradeVolume,
  changePrice: trade.changePrice,
  changeRate: trade.changeRate,
  accumulatedVolume: trade.accumulatedVolume,
  dataMode
});

const selectRecentTrades = (
  trades: MarketTrade[],
  windowMs: number
): MarketTrade[] => {
  const lastTrade = trades.at(-1);

  if (!lastTrade) {
    return [];
  }

  const cutoffMs = Date.parse(lastTrade.receivedAt) - windowMs;

  return trades.filter(
    (trade) => Date.parse(trade.receivedAt) >= cutoffMs
  );
};

const downsampleTrades = (
  trades: MarketTrade[],
  maximumCount: number
): MarketTrade[] => {
  if (trades.length <= maximumCount) {
    return trades;
  }

  return Array.from({ length: maximumCount }, (_, index) => {
    const sourceIndex = Math.round(
      (index * (trades.length - 1)) / (maximumCount - 1)
    );

    return trades[sourceIndex]!;
  });
};

const getTrend = (
  firstTrade: MarketTrade | null,
  latestTrade: MarketTrade | null
): ChartTrend => {
  if (!firstTrade || !latestTrade) {
    return "flat";
  }

  const priceDifference =
    latestTrade.currentPrice - firstTrade.currentPrice;

  if (priceDifference > 0) {
    return "up";
  }

  if (priceDifference < 0) {
    return "down";
  }

  return "flat";
};
