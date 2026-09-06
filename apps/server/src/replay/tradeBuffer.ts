import type { MarketTrade } from "../market/types.js";

const DEFAULT_RETENTION_MS = 60 * 60 * 1000;
const DEFAULT_MAX_TRADES_PER_SYMBOL = 20_000;

interface BufferedTrade {
  trade: MarketTrade;
  receivedAtMs: number;
}

interface TradeBufferOptions {
  retentionMs?: number;
  maxTradesPerSymbol?: number;
}

export class TradeBuffer {
  private readonly tradesBySymbol = new Map<string, BufferedTrade[]>();
  private readonly retentionMs: number;
  private readonly maxTradesPerSymbol: number;

  constructor(options: TradeBufferOptions = {}) {
    this.retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
    this.maxTradesPerSymbol =
      options.maxTradesPerSymbol ?? DEFAULT_MAX_TRADES_PER_SYMBOL;
  }

  add(trade: MarketTrade, receivedAtMs = Date.now()): void {
    const symbol = this.normalizeSymbol(trade.symbol);
    const bufferedTrades = this.tradesBySymbol.get(symbol) ?? [];

    bufferedTrades.push({ trade, receivedAtMs });
    this.removeExpired(bufferedTrades, receivedAtMs);

    if (bufferedTrades.length > this.maxTradesPerSymbol) {
      bufferedTrades.splice(
        0,
        bufferedTrades.length - this.maxTradesPerSymbol
      );
    }

    this.tradesBySymbol.set(symbol, bufferedTrades);
  }

  getRecent(
    symbol: string,
    windowMs: number,
    nowMs = Date.now()
  ): MarketTrade[] {
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      return [];
    }

    const normalizedSymbol = this.normalizeSymbol(symbol);
    const bufferedTrades = this.tradesBySymbol.get(normalizedSymbol);

    if (!bufferedTrades) {
      return [];
    }

    this.removeExpired(bufferedTrades, nowMs);

    if (bufferedTrades.length === 0) {
      this.tradesBySymbol.delete(normalizedSymbol);
      return [];
    }

    const cutoffMs = nowMs - Math.min(windowMs, this.retentionMs);

    return bufferedTrades
      .filter((entry) => entry.receivedAtMs >= cutoffMs)
      .map((entry) => entry.trade);
  }

  getCount(symbol: string, nowMs = Date.now()): number {
    return this.getRecent(symbol, this.retentionMs, nowMs).length;
  }

  private removeExpired(
    bufferedTrades: BufferedTrade[],
    nowMs: number
  ): void {
    const cutoffMs = nowMs - this.retentionMs;
    const firstValidIndex = bufferedTrades.findIndex(
      (entry) => entry.receivedAtMs >= cutoffMs
    );

    if (firstValidIndex === -1) {
      bufferedTrades.length = 0;
      return;
    }

    if (firstValidIndex > 0) {
      bufferedTrades.splice(0, firstValidIndex);
    }
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }
}
