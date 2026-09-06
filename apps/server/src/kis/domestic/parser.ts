import { getMarketInstrument } from "../../market/instruments.js";
import type { MarketTrade } from "../../market/types.js";

const KIS_REALTIME_TRADE_TR_ID = "H0STCNT0";

const KIS_TRADE_INDEX = {
  symbol: 0,              // MKSC_SHRN_ISCD
  tradeTime: 1,           // STCK_CNTG_HOUR
  currentPrice: 2,        // STCK_PRPR
  changePrice: 4,         // PRDY_VRSS
  changeRate: 5,          // PRDY_CTRT
  tradeVolume: 12,        // CNTG_VOL
  accumulatedVolume: 13   // ACML_VOL
} as const;

export const parseKisDomesticTradeMessage = (
  rawMessage: string
): MarketTrade | null => {
  // 실시간 데이터 메시지만 처리
  if (!rawMessage.startsWith("0|") && !rawMessage.startsWith("1|")) {
    return null;
  }

  const parts = rawMessage.split("|");

  // KIS 실시간 메시지 기본 형식 검증
  if (parts.length < 4) {
    return null;
  }

  // 국내주식 실시간 체결가만 처리
  if (parts[1] !== KIS_REALTIME_TRADE_TR_ID) {
    return null;
  }

  const payload = parts.slice(3).join("|");
  const fields = payload.split("^");

  // 현재 사용하는 마지막 필드가 index 13이므로 최소 14개 필요
  if (fields.length <= KIS_TRADE_INDEX.accumulatedVolume) {
    return null;
  }

  const symbol = fields[KIS_TRADE_INDEX.symbol];
  const tradeTime = fields[KIS_TRADE_INDEX.tradeTime];
  const instrument = symbol
    ? getMarketInstrument(symbol)
    : null;

  if (!instrument || instrument.market !== "KR" || !tradeTime) {
    return null;
  }

  const currentPrice = Number(fields[KIS_TRADE_INDEX.currentPrice]);
  const changePrice = Number(fields[KIS_TRADE_INDEX.changePrice]);
  const changeRate = Number(fields[KIS_TRADE_INDEX.changeRate]);
  const tradeVolume = Number(fields[KIS_TRADE_INDEX.tradeVolume]);
  const accumulatedVolume = Number(
    fields[KIS_TRADE_INDEX.accumulatedVolume]
  );

  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(changePrice) ||
    !Number.isFinite(changeRate) ||
    !Number.isFinite(tradeVolume) ||
    !Number.isFinite(accumulatedVolume)
  ) {
    return null;
  }

  return {
    market: instrument.market,
    exchange: instrument.exchange,
    symbol: instrument.symbol,
    stockName: instrument.stockName,
    currency: instrument.currency,
    tradeTime,
    currentPrice,
    changePrice,
    changeRate,
    tradeVolume,
    accumulatedVolume,
    receivedAt: new Date().toISOString()
  };
};

