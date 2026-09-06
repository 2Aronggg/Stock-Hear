import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import {
  buildChartHistory,
  getChartRangeMs,
  parseChartRange
} from "./chart/history.js";
import { config } from "./config.js";
import {
  KisRealtimeSocket,
  type KisConnectionSnapshot
} from "./kis/websocket.js";
import type { MarketTrade } from "./market/types.js";
import {
  ReplaySampleExistsError,
  ReplaySampleStore,
  type ReplaySample
} from "./replay/sampleStore.js";
import { TradeBuffer } from "./replay/tradeBuffer.js";

type ClientMessage =
  | { type: "subscribe"; symbol: string }
  | { type: "unsubscribe"; symbol: string }
  | {
      type: "replay";
      symbol: string;
      windowSeconds: 60 | 180 | 300;
    };

type DataMode = "live" | "replay" | "demo";

interface ReplayProgress {
  symbol: string;
  windowSeconds: 60 | 180 | 300;
  sequence: number;
  total: number;
  sourceTradeCount: number;
  dataMode: "replay" | "demo";
  startedAt: string;
}

type ServerMessage =
  | { type: "connected"; receivedAt: string }
  | { type: "subscribed"; symbol: string; receivedAt: string }
  | { type: "unsubscribed"; symbol: string; receivedAt: string }
  | {
      type: "trade";
      trade: MarketTrade;
      dataMode: DataMode;
      replay?: ReplayProgress;
    }
  | {
      type: "replay_started";
      symbol: string;
      windowSeconds: 60 | 180 | 300;
      tradeCount: number;
      sourceTradeCount: number;
      dataMode: "replay" | "demo";
      receivedAt: string;
    }
  | {
      type: "replay_completed";
      symbol: string;
      dataMode: "replay" | "demo";
      receivedAt: string;
    }
  | { type: "error"; message: string; receivedAt: string };

const MOCK_SURGE_SYMBOL = "MOCK_SURGE";

const app = express();
const httpServer = createServer(app);

const socketServer = new WebSocketServer({
  server: httpServer,
  path: "/ws"
});

const kisSocket = new KisRealtimeSocket();
const tradeBuffer = new TradeBuffer();
const replaySampleStore = new ReplaySampleStore();
const serverStartedAt = Date.now();
const replaySampleWindowMs = 5 * 60 * 1000;
const replayIntervalMs = 150;
const maxReplayTrades = 300;
const replayCoverageToleranceMs = 5 * 1000;

let kisConnection = kisSocket.getConnectionSnapshot();
let lastTradeAt: string | null = null;
let replaySampleStatus: "loading" | "ready" | "error" = "loading";
let replaySamples = new Map<string, ReplaySample>();

kisSocket.onConnectionStatusChange((snapshot) => {
  kisConnection = snapshot;
});

/*
 * 각 프론트가 현재 어떤 종목을 선택했는지 저장
 *
 * socket A -> 005930
 * socket B -> 035420
 */
const clientSymbols = new Map<WebSocket, string>();

/*
 * 같은 종목을 몇 개의 프론트가 사용 중인지 저장
 *
 * 005930 -> 2
 * 035420 -> 1
 *
 * 0 -> 1이 될 때만 KIS subscribe
 * 1 -> 0이 될 때만 KIS unsubscribe
 */
const symbolClientCounts = new Map<string, number>();

// Mock 실행 타이머
const mockTimers = new Map<
  WebSocket,
  ReturnType<typeof setInterval>
>();

interface ReplaySession {
  timer: ReturnType<typeof setTimeout> | null;
}

const replaySessions = new Map<WebSocket, ReplaySession>();

app.use(cors({ origin: config.CLIENT_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  const status = getServiceStatus(kisConnection);

  response.json({
    status,
    service: "stock-hear-server",
    server: "ok",
    kis: {
      status: kisConnection.status,
      environment: config.KIS_ENVIRONMENT,
      lastConnectedAt: kisConnection.lastConnectedAt,
      lastDisconnectedAt: kisConnection.lastDisconnectedAt,
      lastErrorAt: kisConnection.lastErrorAt,
      lastTradeAt
    },
    replay: {
      status: replaySampleStatus,
      sampleCount: replaySamples.size,
      symbols: [...replaySamples.keys()]
    },
    uptimeSeconds: Math.floor(
      (Date.now() - serverStartedAt) / 1000
    ),
    receivedAt: new Date().toISOString()
  });
});

app.get("/api/chart/history/:symbol", (request, response) => {
  const symbol = request.params.symbol?.trim().toUpperCase();
  const range = parseChartRange(request.query.range);

  if (!symbol) {
    response.status(400).json({
      error: "A stock symbol is required."
    });
    return;
  }

  if (!range) {
    response.status(400).json({
      error: "range must be one of 5m, 30m, or 1h."
    });
    return;
  }

  const liveTrades = tradeBuffer.getRecent(
    symbol,
    getChartRangeMs(range)
  );
  const sample = replaySamples.get(symbol);

  response.json(
    buildChartHistory(symbol, range, liveTrades, sample)
  );
});

app.post("/api/replay/samples/:symbol", async (request, response) => {
  if (!config.REPLAY_SAMPLE_WRITE_ENABLED) {
    response.status(403).json({
      error: "Replay sample capture is disabled."
    });
    return;
  }

  const symbol = request.params.symbol?.trim().toUpperCase();

  if (!symbol) {
    response.status(400).json({
      error: "A stock symbol is required."
    });
    return;
  }

  const trades = tradeBuffer.getRecent(
    symbol,
    replaySampleWindowMs
  );

  if (trades.length === 0) {
    response.status(409).json({
      error: `No buffered trades are available for ${symbol}.`
    });
    return;
  }

  try {
    const savedSample = await replaySampleStore.save(symbol, trades);
    const loadedSample = await replaySampleStore.load(symbol);

    if (loadedSample) {
      replaySamples.set(symbol, loadedSample);
      replaySampleStatus = "ready";
    }

    response.status(201).json({
      status: "created",
      sample: savedSample
    });
  } catch (error) {
    if (error instanceof ReplaySampleExistsError) {
      response.status(409).json({
        error: error.message
      });
      return;
    }

    console.error("Failed to save replay sample", error);
    response.status(500).json({
      error: "Failed to save replay sample."
    });
  }
});

const getServiceStatus = (
  connection: KisConnectionSnapshot
): "ok" | "starting" | "degraded" => {
  if (connection.status === "connected") {
    return "ok";
  }

  if (
    connection.status === "connecting" &&
    connection.lastConnectedAt === null
  ) {
    return "starting";
  }

  return "degraded";
};

const sendJson = (
  socket: WebSocket,
  message: ServerMessage
): void => {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
};

const acquireKisSymbol = (symbol: string): void => {
  const currentCount = symbolClientCounts.get(symbol) ?? 0;

  if (currentCount === 0) {
    kisSocket.subscribe(symbol);
  }

  symbolClientCounts.set(symbol, currentCount + 1);
};

const releaseKisSymbol = (symbol: string): void => {
  const currentCount = symbolClientCounts.get(symbol) ?? 0;

  if (currentCount <= 1) {
    symbolClientCounts.delete(symbol);
    kisSocket.unsubscribe(symbol);
    return;
  }

  symbolClientCounts.set(symbol, currentCount - 1);
};

const stopMock = (socket: WebSocket): void => {
  const timer = mockTimers.get(socket);

  if (timer) {
    clearInterval(timer);
    mockTimers.delete(socket);
  }
};

const createMockTrade = (tick: number): MarketTrade => {
  const now = new Date();

  const tradeTime = [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join("");

  const currentPrice = 15000 + tick * 50;
  const changePrice = currentPrice - 12000;

  return {
    market: "KR",
    exchange: "DEMO",
    symbol: MOCK_SURGE_SYMBOL,
    stockName: "급등주 Mock",
    currency: "KRW",
    tradeTime,
    currentPrice,
    changePrice,
    changeRate: 25,
    tradeVolume:
      tick % 3 === 0
        ? 500000
        : tick % 2 === 0
          ? 50000
          : 5000,
    accumulatedVolume: 10000000 + tick * 500000,
    receivedAt: now.toISOString()
  };
};

const stopReplay = (socket: WebSocket): void => {
  const session = replaySessions.get(socket);

  if (session?.timer) {
    clearTimeout(session.timer);
  }

  replaySessions.delete(socket);
};

const startMock = (socket: WebSocket): void => {
  stopMock(socket);

  let tick = 0;

  const sendMockTrade = (): void => {
    tick += 1;

    sendJson(socket, {
      type: "trade",
      trade: createMockTrade(tick),
      dataMode: "demo"
    });
  };

  // 선택 직후 바로 한 번 전송
  sendMockTrade();

  const timer = setInterval(sendMockTrade, 1000);
  mockTimers.set(socket, timer);

  console.info("[MOCK] surge data started");
};

const releaseClientSubscription = (
  socket: WebSocket
): void => {
  stopReplay(socket);

  const currentSymbol = clientSymbols.get(socket);

  if (!currentSymbol) {
    return;
  }

  if (currentSymbol === MOCK_SURGE_SYMBOL) {
    stopMock(socket);
  } else {
    releaseKisSymbol(currentSymbol);
  }

  clientSymbols.delete(socket);
};

const subscribeClient = (
  socket: WebSocket,
  symbol: string
): void => {
  const currentSymbol = clientSymbols.get(socket);

  // 이미 같은 종목이면 아무 작업도 하지 않음
  if (currentSymbol === symbol) {
    sendJson(socket, {
      type: "subscribed",
      symbol,
      receivedAt: new Date().toISOString()
    });

    return;
  }

  // 기존 종목이 있다면 먼저 정리
  releaseClientSubscription(socket);

  clientSymbols.set(socket, symbol);

  if (symbol === MOCK_SURGE_SYMBOL) {
    startMock(socket);
  } else {
    acquireKisSymbol(symbol);
  }

  sendJson(socket, {
    type: "subscribed",
    symbol,
    receivedAt: new Date().toISOString()
  });

  console.info("[SERVER WS] client subscribed", {
    symbol
  });
};

const unsubscribeClient = (
  socket: WebSocket,
  symbol: string
): void => {
  const currentSymbol = clientSymbols.get(socket);

  // 이 클라이언트가 현재 선택한 종목이 아닌 경우 무시
  if (currentSymbol !== symbol) {
    return;
  }

  releaseClientSubscription(socket);

  sendJson(socket, {
    type: "unsubscribed",
    symbol,
    receivedAt: new Date().toISOString()
  });

  console.info("[SERVER WS] client unsubscribed", {
    symbol
  });
};

const parseClientMessage = (
  rawMessage: string
): ClientMessage | null => {
  try {
    const parsed: unknown = JSON.parse(rawMessage);

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (typeof record.symbol !== "string") {
      return null;
    }

    const symbol = record.symbol.trim().toUpperCase();

    if (!symbol) {
      return null;
    }

    if (
      record.type === "subscribe" ||
      record.type === "unsubscribe"
    ) {

      return {
        type: record.type,
        symbol
      };
    }

    if (
      record.type === "replay" &&
      (record.windowSeconds === 60 ||
        record.windowSeconds === 180 ||
        record.windowSeconds === 300)
    ) {
      return {
        type: "replay",
        symbol,
        windowSeconds: record.windowSeconds
      };
    }

    return null;
  } catch {
    return null;
  }
};

const selectReplayWindow = (
  trades: MarketTrade[],
  windowSeconds: 60 | 180 | 300
): MarketTrade[] => {
  const lastTrade = trades.at(-1);

  if (!lastTrade) {
    return [];
  }

  const cutoffMs = Date.parse(lastTrade.receivedAt) - windowSeconds * 1000;

  return trades.filter(
    (trade) => Date.parse(trade.receivedAt) >= cutoffMs
  );
};

const hasReplayCoverage = (
  trades: MarketTrade[],
  windowSeconds: 60 | 180 | 300
): boolean => {
  const firstTrade = trades[0];
  const lastTrade = trades.at(-1);

  if (!firstTrade || !lastTrade) {
    return false;
  }

  const durationMs =
    Date.parse(lastTrade.receivedAt) - Date.parse(firstTrade.receivedAt);

  return durationMs >= windowSeconds * 1000 - replayCoverageToleranceMs;
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

const startReplay = (
  socket: WebSocket,
  symbol: string,
  windowSeconds: 60 | 180 | 300
): void => {
  releaseClientSubscription(socket);

  const bufferedTrades = tradeBuffer.getRecent(
    symbol,
    windowSeconds * 1000
  );
  const sample = replaySamples.get(symbol);
  const useBuffer =
    hasReplayCoverage(bufferedTrades, windowSeconds) || !sample;
  const dataMode: Exclude<DataMode, "live"> = useBuffer
    ? "replay"
    : "demo";
  const sourceTrades = useBuffer
    ? bufferedTrades
    : selectReplayWindow(sample.trades, windowSeconds);
  const replayTrades = downsampleTrades(sourceTrades, maxReplayTrades);

  if (replayTrades.length === 0) {
    sendJson(socket, {
      type: "error",
      message: `Replay data is not available for ${symbol}.`,
      receivedAt: new Date().toISOString()
    });
    return;
  }

  const session: ReplaySession = { timer: null };
  const replayStartedAt = new Date().toISOString();
  replaySessions.set(socket, session);

  sendJson(socket, {
    type: "replay_started",
    symbol,
    windowSeconds,
    tradeCount: replayTrades.length,
    sourceTradeCount: sourceTrades.length,
    dataMode,
    receivedAt: replayStartedAt
  });

  let index = 0;

  const sendNextTrade = (): void => {
    if (replaySessions.get(socket) !== session) {
      return;
    }

    const trade = replayTrades[index];

    if (!trade) {
      replaySessions.delete(socket);
      sendJson(socket, {
        type: "replay_completed",
        symbol,
        dataMode,
        receivedAt: new Date().toISOString()
      });
      subscribeClient(socket, symbol);
      return;
    }

    sendJson(socket, {
      type: "trade",
      trade,
      dataMode,
      replay: {
        symbol,
        windowSeconds,
        sequence: index,
        total: replayTrades.length,
        sourceTradeCount: sourceTrades.length,
        dataMode,
        startedAt: replayStartedAt
      }
    });

    index += 1;
    session.timer = setTimeout(sendNextTrade, replayIntervalMs);
  };

  sendNextTrade();
};

const handleClientMessage = (
  socket: WebSocket,
  rawMessage: string
): void => {
  const message = parseClientMessage(rawMessage);

  if (!message) {
    sendJson(socket, {
      type: "error",
      message: "Invalid WebSocket message.",
      receivedAt: new Date().toISOString()
    });

    return;
  }

  if (message.type === "subscribe") {
    subscribeClient(socket, message.symbol);
    return;
  }

  if (message.type === "replay") {
    startReplay(socket, message.symbol, message.windowSeconds);
    return;
  }

  unsubscribeClient(socket, message.symbol);
};

// 프론트 WebSocket
socketServer.on("connection", (socket) => {
  console.info("[SERVER WS] frontend connected");

  sendJson(socket, {
    type: "connected",
    receivedAt: new Date().toISOString()
  });

  socket.on("message", (data) => {
    handleClientMessage(socket, data.toString());
  });

  socket.on("close", () => {
    /*
     * 중요:
     * 브라우저/HMR/서버 재연결 등으로 프론트가 사라지면
     * 해당 프론트가 사용하던 KIS 구독도 정리
     */
    releaseClientSubscription(socket);

    console.info("[SERVER WS] frontend disconnected");
  });
});

/*
 * KIS trade는 해당 symbol을 선택한 프론트에만 전달.
 * 더 이상 전체 broadcast하지 않음.
 */
kisSocket.onTrade((trade) => {
  lastTradeAt = new Date().toISOString();
  tradeBuffer.add(trade);

  for (const [client, symbol] of clientSymbols) {
    if (symbol !== trade.symbol) {
      continue;
    }

    sendJson(client, {
      type: "trade",
      trade,
      dataMode: "live"
    });
  }
});

const startServer = (): void => {
  httpServer.listen(config.PORT, () => {
    console.info("stock-hear server started", {
      port: config.PORT,
      clientOrigin: config.CLIENT_ORIGIN
    });

    void replaySampleStore
      .loadAll()
      .then((samples) => {
        replaySamples = samples;
        replaySampleStatus = "ready";

        console.info("Replay samples loaded", {
          count: samples.size,
          symbols: [...samples.keys()]
        });
      })
      .catch((error: unknown) => {
        replaySampleStatus = "error";
        console.error("Failed to load replay samples", error);
      });

    void kisSocket.connect().catch((error: unknown) => {
      console.error(
        "Initial KIS connection failed; server remains available.",
        error
      );
    });
  });
};

startServer();
