export type Market = "KR" | "US";
export type Currency = "KRW" | "USD";

export interface MarketTrade {
  market: Market;
  exchange: string;
  symbol: string;
  stockName: string;
  currency: Currency;
  currentPrice: number;
  changePrice: number;
  changeRate: number;
  tradeVolume: number;
  accumulatedVolume: number;
  tradeTime: string;
  receivedAt: string;
}
