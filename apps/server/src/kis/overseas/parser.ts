import { getMarketInstrument } from "../../market/instruments.js";
import type { MarketTrade } from "../../market/types.js";

const KIS_OVERSEAS_TRADE_TR_ID = "HDFSCNT0";

const KIS_OVERSEAS_TRADE_INDEX = {
  symbol: 0,             // SYMB
  localTradeTime: 4,     // XHMS
  koreaTradeTime: 6,     // KHMS
  currentPrice: 10,      // LAST
  changeSign: 11,        // SIGN
  changePrice: 12,       // DIFF
  changeRate: 13,        // RATE
  tradeVolume: 18,       // EVOL
  accumulatedVolume: 19 // TVOL
} as const;

export const parseKisOverseasTradeMessage = (
  rawMessage: string
): MarketTrade | null => {
  if (!rawMessage.startsWith("0|") && !rawMessage.startsWith("1|")) {
    return null;
  }

  const parts = rawMessage.split("|");

  if (parts.length < 4 || parts[1] !== KIS_OVERSEAS_TRADE_TR_ID) {
    return null;
  }

  const fields = parts.slice(3).join("|").split("^");

  if (fields.length <= KIS_OVERSEAS_TRADE_INDEX.accumulatedVolume) {
    return null;
  }

  // 일부 KIS WebSocket 환경은 맨 앞에 실시간 조회 심볼(RSYM)을
  // 추가해 26개 필드를 전송한다. 공식 25개 형식과 모두 호환한다.
  const valueOffset = fields.length >= 26 ? 1 : 0;
  const rawSymbol =
    fields[KIS_OVERSEAS_TRADE_INDEX.symbol] ||
    fields[KIS_OVERSEAS_TRADE_INDEX.symbol + valueOffset];
  const instrument = rawSymbol
    ? getMarketInstrument(rawSymbol)
    : null;

  if (!instrument || instrument.market !== "US") {
    return null;
  }

  const tradeTime =
    fields[KIS_OVERSEAS_TRADE_INDEX.koreaTradeTime + valueOffset] ||
    fields[KIS_OVERSEAS_TRADE_INDEX.localTradeTime + valueOffset];
  const currentPrice = Number(
    fields[KIS_OVERSEAS_TRADE_INDEX.currentPrice + valueOffset]
  );
  const changeSign = fields[
    KIS_OVERSEAS_TRADE_INDEX.changeSign + valueOffset
  ];
  const rawChangePrice = Number(
    fields[KIS_OVERSEAS_TRADE_INDEX.changePrice + valueOffset]
  );
  const rawChangeRate = Number(
    fields[KIS_OVERSEAS_TRADE_INDEX.changeRate + valueOffset]
  );
  const tradeVolume = Number(
    fields[KIS_OVERSEAS_TRADE_INDEX.tradeVolume + valueOffset]
  );
  const accumulatedVolume = Number(
    fields[KIS_OVERSEAS_TRADE_INDEX.accumulatedVolume + valueOffset]
  );

  if (
    !tradeTime ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(rawChangePrice) ||
    !Number.isFinite(rawChangeRate) ||
    !Number.isFinite(tradeVolume) ||
    !Number.isFinite(accumulatedVolume)
  ) {
    return null;
  }

  const changeDirection = getChangeDirection(changeSign);
  const changePrice = Math.abs(rawChangePrice) * changeDirection;
  const changeRate = Math.abs(rawChangeRate) * changeDirection;

  return {
    market: instrument.market,
    exchange: instrument.exchange,
    symbol: instrument.symbol,
    stockName: instrument.stockName,
    currency: instrument.currency,
    currentPrice,
    changePrice,
    changeRate,
    tradeVolume,
    accumulatedVolume,
    tradeTime,
    receivedAt: new Date().toISOString()
  };
};

const getChangeDirection = (sign: string | undefined): -1 | 0 | 1 => {
  if (sign === "3") {
    return 0;
  }

  if (sign === "4" || sign === "5") {
    return -1;
  }

  return 1;
};
