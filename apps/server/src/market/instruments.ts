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
  createKoreanInstrument("373220", "LG에너지솔루션"),
  createKoreanInstrument("207940", "삼성바이오로직스"),
  createKoreanInstrument("005380", "현대차"),
  createKoreanInstrument("000270", "기아"),
  createKoreanInstrument("068270", "셀트리온"),
  createKoreanInstrument("105560", "KB금융"),
  createKoreanInstrument("035420", "NAVER"),
  createKoreanInstrument("035720", "카카오"),
  createKoreanInstrument("005490", "POSCO홀딩스"),
  createKoreanInstrument("051910", "LG화학"),
  createKoreanInstrument("006400", "삼성SDI"),
  createKoreanInstrument("012330", "현대모비스"),
  createKoreanInstrument("055550", "신한지주"),
  createKoreanInstrument("086790", "하나금융지주"),
  createKoreanInstrument("028260", "삼성물산"),
  createKoreanInstrument("096770", "SK이노베이션"),
  createKoreanInstrument("066570", "LG전자"),
  createKoreanInstrument("323410", "카카오뱅크"),
  createKoreanInstrument("034020", "두산에너빌리티"),
  createKoreanInstrument("003670", "포스코퓨처엠"),
  createKoreanInstrument("009150", "삼성전기"),
  createKoreanInstrument("017670", "SK텔레콤"),
  createKoreanInstrument("030200", "KT"),
  createKoreanInstrument("259960", "크래프톤"),
  createKoreanInstrument("352820", "하이브"),
  createKoreanInstrument("042660", "한화오션"),
  createKoreanInstrument("010140", "삼성중공업"),
  createKoreanInstrument("011200", "HMM"),
  createKoreanInstrument("122630", "KODEX 레버리지"),
  createKoreanInstrument("041190", "우리기술투자"),
  createNasdaqInstrument("AAPL", "Apple"),
  createNasdaqInstrument("MSFT", "Microsoft"),
  createNasdaqInstrument("NVDA", "NVIDIA"),
  createNasdaqInstrument("TSLA", "Tesla"),
  createNasdaqInstrument("GOOGL", "Alphabet"),
  createNasdaqInstrument("AMZN", "Amazon"),
  createNasdaqInstrument("META", "Meta"),
  createNasdaqInstrument("NFLX", "Netflix"),
  createNasdaqInstrument("AMD", "AMD"),
  createNasdaqInstrument("INTC", "Intel"),
  createNasdaqInstrument("AVGO", "Broadcom"),
  createNasdaqInstrument("QCOM", "Qualcomm"),
  createNasdaqInstrument("ADBE", "Adobe"),
  createNasdaqInstrument("COST", "Costco"),
  createNasdaqInstrument("PEP", "PepsiCo"),
  createNasdaqInstrument("SBUX", "Starbucks"),
  createNasdaqInstrument("CSCO", "Cisco"),
  createNasdaqInstrument("TXN", "Texas Instruments"),
  createNasdaqInstrument("PYPL", "PayPal")
];

export const getMarketInstruments = (): readonly MarketInstrument[] =>
  instruments;

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
