import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import { config } from "./config.js";
import { KisRealtimeSocket } from "./kis/websocket.js";
import type { RealtimeTrade } from "./kis/parser.js";

type ClientMessage =
  | { type: "subscribe"; symbol: string }
  | { type: "unsubscribe"; symbol: string };

type ServerMessage =
  | { type: "connected"; receivedAt: string }
  | { type: "subscribed"; symbol: string; receivedAt: string }
  | { type: "unsubscribed"; symbol: string; receivedAt: string }
  | { type: "trade"; trade: RealtimeTrade }
  | { type: "error"; message: string; receivedAt: string };

const MOCK_SURGE_SYMBOL = "MOCK_SURGE";

const app = express();
const httpServer = createServer(app);

const socketServer = new WebSocketServer({
  server: httpServer,
  path: "/ws"
});

const kisSocket = new KisRealtimeSocket();

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

app.use(cors({ origin: config.CLIENT_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "stock-hear-server",
    kisEnvironment: config.KIS_ENVIRONMENT,
    receivedAt: new Date().toISOString()
  });
});

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

const createMockTrade = (tick: number): RealtimeTrade => {
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
    symbol: MOCK_SURGE_SYMBOL,
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
    accumulatedVolume: 10000000 + tick * 500000
  };
};

const startMock = (socket: WebSocket): void => {
  stopMock(socket);

  let tick = 0;

  const sendMockTrade = (): void => {
    tick += 1;

    sendJson(socket, {
      type: "trade",
      trade: createMockTrade(tick)
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

    if (
      (record.type === "subscribe" ||
        record.type === "unsubscribe") &&
      typeof record.symbol === "string"
    ) {
      const symbol = record.symbol.trim();

      if (!symbol) {
        return null;
      }

      return {
        type: record.type,
        symbol
      };
    }

    return null;
  } catch {
    return null;
  }
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
  for (const [client, symbol] of clientSymbols) {
    if (symbol !== trade.symbol) {
      continue;
    }

    sendJson(client, {
      type: "trade",
      trade
    });
  }
});

const startServer = async (): Promise<void> => {
  try {
    await kisSocket.connect();

    httpServer.listen(config.PORT, () => {
      console.info("stock-hear server started", {
        port: config.PORT,
        clientOrigin: config.CLIENT_ORIGIN
      });
    });
  } catch (error) {
  console.error(
    "Failed to start stock-hear server because KIS connection failed.",
    error
  );

    process.exitCode = 1;
  }
};

void startServer();

