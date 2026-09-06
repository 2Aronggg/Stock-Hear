import type { MarketTrade } from "../market/types.js";
import { parseKisDomesticTradeMessage } from "./domestic/parser.js";
import { parseKisOverseasTradeMessage } from "./overseas/parser.js";

export const parseMarketTradeMessage = (
  rawMessage: string
): MarketTrade | null =>
  parseKisDomesticTradeMessage(rawMessage) ??
  parseKisOverseasTradeMessage(rawMessage);
