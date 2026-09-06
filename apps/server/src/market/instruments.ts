import type { Currency, Market } from "./types.js";

export interface MarketInstrument {
  market: Market;
  exchange: string;
  symbol: string;
  stockName: string;
  currency: Currency;
  kisTrId: "H0STCNT0" | "HDFSCNT0";
  kisTrKey: string;
}

const instruments: readonly MarketInstrument[] = [
  createKoreanInstrument("005930", "삼성전자"),
  createKoreanInstrument("000660", "SK하이닉스"),
  createKoreanInstrument("035420", "NAVER"),
  createKoreanInstrument("122630", "KODEX 레버리지"),
  createKoreanInstrument("041190", "우리기술투자"),
  createNasdaqInstrument("AAPL", "Apple"),
  createNasdaqInstrument("MSFT", "Microsoft"),
  createNasdaqInstrument("NVDA", "NVIDIA"),
  createNasdaqInstrument("TSLA", "Tesla")
];

function createKoreanInstrument(
  symbol: string,
  stockName: string
): MarketInstrument {
  return {
    market: "KR",
    exchange: "KRX",
    symbol,
    stockName,
    currency: "KRW",
    kisTrId: "H0STCNT0",
    kisTrKey: symbol
  };
}

function createNasdaqInstrument(
  symbol: string,
  stockName: string
): MarketInstrument {
  return {
    market: "US",
    exchange: "NASDAQ",
    symbol,
    stockName,
    currency: "USD",
    kisTrId: "HDFSCNT0",
    kisTrKey: `DNAS${symbol}`
  };
}

export const getMarketInstrument = (
  symbol: string
): MarketInstrument | null => {
  const normalizedSymbol = symbol.trim().toUpperCase();

  return (
    instruments.find(
      (instrument) =>
        instrument.symbol === normalizedSymbol ||
        instrument.kisTrKey === normalizedSymbol
    ) ?? null
  );
};
