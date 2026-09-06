import WebSocket from "ws";

import { config } from "../config.js";
import { getMarketInstrument } from "../market/instruments.js";
import type { MarketTrade } from "../market/types.js";
import { requestKisApprovalKey } from "./auth.js";
import { parseMarketTradeMessage } from "./parser.js";

export type TradeHandler = (trade: MarketTrade) => void;
export type KisConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface KisConnectionSnapshot {
  status: KisConnectionStatus;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastErrorAt: string | null;
}

export type ConnectionStatusHandler = (
  snapshot: KisConnectionSnapshot
) => void;

const RECONNECT_DELAY_MS = 3000;

export class KisRealtimeSocket {
  /*
   * 현재 서버가 필요로 하는 종목 목록
   * KIS 연결이 잠깐 끊겨도 이 목록은 유지
   * 재연결 성공 시 목록에 있는 종목을 다시 KIS에 구독 요청
   */
  private readonly subscriptions = new Set<string>();

  // 체결 데이터 수신 시 실행할 콜백
  private tradeHandler: TradeHandler | null = null;

  private connectionStatusHandler: ConnectionStatusHandler | null = null;

  private connectionSnapshot: KisConnectionSnapshot = {
    status: "disconnected",
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastErrorAt: null
  };

  // 실제 KIS WebSocket
  private socket: WebSocket | null = null;

  // auth.ts에서 발급받은 approval key
  private approvalKey: string | null = null;

  // KIS 재연결 타이머
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // 동시에 여러 연결 요청이 발생하는 것을 방지
  private isConnecting = false;

  // 최초 한 번이라도 정상 연결된 적이 있는지
  private hasConnectedOnce = false;

  onTrade(handler: TradeHandler): void {
    this.tradeHandler = handler;
  }

  onConnectionStatusChange(handler: ConnectionStatusHandler): void {
    this.connectionStatusHandler = handler;
    handler(this.getConnectionSnapshot());
  }

  getConnectionSnapshot(): KisConnectionSnapshot {
    return { ...this.connectionSnapshot };
  }

  /*
   * 최초 KIS 연결
   * approval key를 발급받고 KIS WebSocket을 연결
   * 이후 연결이 끊기면 scheduleReconnect()에서 자동 복구
   */
  async connect(): Promise<void> {
    // 이미 연결되어 있거나 연결 중이면 중복 연결 방지
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.isConnecting
    ) {
      return;
    }

    this.updateConnectionStatus(
      this.hasConnectedOnce ? "reconnecting" : "connecting"
    );

    try {
      const websocketUrl = config.KIS_WEBSOCKET_URL;

      if (!websocketUrl) {
        throw new Error("KIS WebSocket URL is not configured.");
      }

      // 최초 연결 시 approval key 발급
      if (!this.approvalKey) {
        this.approvalKey = await requestKisApprovalKey();
      }

      await this.openSocket(websocketUrl, this.hasConnectedOnce);
    } catch (error) {
      this.updateConnectionStatus("error", {
        lastErrorAt: new Date().toISOString()
      });
      this.scheduleReconnect();
      throw error;
    }
  }

  /*
   * 실제 WebSocket 객체 생성
   *
   * isReconnect:
   * false -> 최초 연결
   * true  -> 연결 끊김 후 재연결
   */
  private openSocket(
    websocketUrl: string,
    isReconnect: boolean
  ): Promise<void> {
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(websocketUrl);

      this.socket = socket;

      let settled = false;

      socket.on("open", () => {
        this.isConnecting = false;
        this.hasConnectedOnce = true;
        this.updateConnectionStatus("connected", {
          lastConnectedAt: new Date().toISOString()
        });

        if (isReconnect) {
          console.info("[KIS WS] reconnected");

          // 연결이 끊겨 있던 동안 필요했던 종목들을 다시 구독
          this.resubscribeAll();
        } else {
          console.info("[KIS WS] connected");
        }

        if (!settled) {
          settled = true;
          resolve();
        }
      });

      socket.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      socket.on("error", () => {
        console.error("[KIS WS] connection error");

        this.updateConnectionStatus("error", {
          lastErrorAt: new Date().toISOString()
        });

        // 최초 연결 과정에서 실패한 경우
        if (
          socket.readyState !== WebSocket.OPEN &&
          !settled
        ) {
          this.isConnecting = false;
          settled = true;

          reject(
            new Error("Failed to connect to KIS WebSocket.")
          );
        }
      });

      socket.on("close", () => {
        console.info("[KIS WS] disconnected");

        this.updateConnectionStatus("disconnected", {
          lastDisconnectedAt: new Date().toISOString()
        });

        // 이전 socket의 close 이벤트가
        // 새 socket을 null로 만들어버리는 것 방지
        if (this.socket === socket) {
          this.socket = null;
        }

        this.isConnecting = false;

        /*
         * 중요:
         * subscriptions.clear() 하지 않음
         * KIS 연결만 끊긴 것이므로
         * 프론트가 여전히 보고 있는 종목 목록은 유지
         */

        this.scheduleReconnect();
      });
    });
  }

  /*
   * KIS 연결 끊김 후 자동 재연결
   */
  private scheduleReconnect(): void {
    // 이미 재연결 예약이 있다면 중복 예약 방지
    if (this.reconnectTimer !== null) {
      return;
    }

    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.isConnecting
    ) {
      return;
    }

    console.info("[KIS WS] reconnect scheduled", {
      delayMs: RECONNECT_DELAY_MS
    });

    this.updateConnectionStatus("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      const websocketUrl = config.KIS_WEBSOCKET_URL;

      if (!websocketUrl) {
        console.error(
          "[KIS WS] WebSocket URL is not configured"
        );
        return;
      }

      void this.connect().catch(
        (error: unknown) => {
          console.error(
            "[KIS WS] reconnect failed",
            error
          );
        }
      );
    }, RECONNECT_DELAY_MS);
  }

  /*
   * KIS 재연결 후 현재 필요한 종목들을 다시 구독
   */
  private resubscribeAll(): void {
    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    if (!this.approvalKey) {
      console.error(
        "[KIS WS] approval key is not available"
      );
      return;
    }

    for (const symbol of this.subscriptions) {
      this.sendSubscriptionMessage(symbol, "1");

      const instrument = getMarketInstrument(symbol);

      console.info("[KIS WS] resubscription requested", {
        trId: instrument?.kisTrId,
        symbol
      });
    }
  }

  /*
   * 새로운 종목 구독
   */
  subscribe(symbol: string): void {
    const normalizedSymbol = symbol.trim();
    const instrument = getMarketInstrument(normalizedSymbol);

    if (!normalizedSymbol || !instrument) {
      console.error("[KIS WS] invalid stock symbol");
      return;
    }

    // 같은 종목 중복 구독 방지
    if (this.subscriptions.has(normalizedSymbol)) {
      console.info("[KIS WS] already subscribed locally", {
        symbol: normalizedSymbol
      });
      return;
    }

    /*
     * 먼저 "필요한 종목"으로 기록
     * KIS가 현재 끊겨 있더라도 이 목록에 들어가므로,
     * 재연결 성공 후 resubscribeAll()에서 자동 구독
     */
    this.subscriptions.add(normalizedSymbol);

    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    ) {
      console.info("[KIS WS] subscription queued", {
        symbol: normalizedSymbol
      });
      return;
    }

    if (!this.approvalKey) {
      console.error(
        "[KIS WS] approval key is not available"
      );
      return;
    }

    this.sendSubscriptionMessage(
      normalizedSymbol,
      "1"
    );

    console.info("[KIS WS] subscription requested", {
      trId: instrument.kisTrId,
      symbol: normalizedSymbol
    });
  }

  /*
   * 기존 종목 구독 해제
   */
  unsubscribe(symbol: string): void {
    const normalizedSymbol = symbol.trim();
    const instrument = getMarketInstrument(normalizedSymbol);

    if (!normalizedSymbol || !instrument) {
      console.error("[KIS WS] invalid stock symbol");
      return;
    }

    if (!this.subscriptions.has(normalizedSymbol)) {
      console.info(
        "[KIS WS] symbol is not subscribed locally",
        {
          symbol: normalizedSymbol
        }
      );

      return;
    }

    /*
     * 먼저 필요한 종목 목록에서 제거
     * KIS가 끊어진 상태에서 사용자가 다른 종목으로
     * 이동하더라도 재연결 시 이 종목이 살아나지 않음
     */
    this.subscriptions.delete(normalizedSymbol);

    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    ) {
      console.info(
        "[KIS WS] unsubscription applied while disconnected",
        {
          symbol: normalizedSymbol
        }
      );

      return;
    }

    if (!this.approvalKey) {
      console.error(
        "[KIS WS] approval key is not available"
      );
      return;
    }

    this.sendSubscriptionMessage(
      normalizedSymbol,
      "2"
    );

    console.info("[KIS WS] unsubscription requested", {
      trId: instrument.kisTrId,
      symbol: normalizedSymbol
    });
  }

  /*
   * KIS subscribe / unsubscribe 공통 메시지 전송
   */
  private sendSubscriptionMessage(
    symbol: string,
    trType: "1" | "2"
  ): void {
    if (
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      !this.approvalKey
    ) {
      return;
    }

    const instrument = getMarketInstrument(symbol);

    if (!instrument) {
      return;
    }

    const message = {
      header: {
        approval_key: this.approvalKey,
        custtype: "P",
        tr_type: trType,
        "content-type": "utf-8"
      },
      body: {
        input: {
          tr_id: instrument.kisTrId,
          tr_key: instrument.kisTrKey
        }
      }
    };

    this.socket.send(JSON.stringify(message));
  }

  getSubscriptions(): string[] {
    return [...this.subscriptions];
  }

  /*
   * KIS가 보내는 메시지 처리
   */
  private handleMessage(rawMessage: string): void {
    if (!rawMessage) {
      console.error("[KIS WS] empty message received");
      return;
    }

    try {
      // 실시간 체결 데이터
      if (
        rawMessage.startsWith("0|") ||
        rawMessage.startsWith("1|")
      ) {
        const trade = parseMarketTradeMessage(rawMessage);

        if (!trade) {
          console.error(
            "[KIS WS] failed to parse realtime trade"
          );
          return;
        }

        console.info("[KIS WS] realtime trade parsed", {
          symbol: trade.symbol,
          currentPrice: trade.currentPrice,
          changeRate: trade.changeRate,
          tradeVolume: trade.tradeVolume
        });

        this.emitTrade(trade);
        return;
      }

      // JSON 시스템 메시지
      const message: unknown = JSON.parse(rawMessage);

      if (!this.isRecord(message)) {
        console.error(
          "[KIS WS] invalid system message"
        );
        return;
      }

      const header = message.header;

      if (!this.isRecord(header)) {
        console.error(
          "[KIS WS] invalid system header"
        );
        return;
      }

      const trId = header.tr_id;

      // KIS 연결 유지 메시지
      if (trId === "PINGPONG") {
        if (
          this.socket?.readyState === WebSocket.OPEN
        ) {
          this.socket.pong(rawMessage);
        }

        console.info("[KIS WS] PINGPONG");
        return;
      }

      const body = message.body;

      const msg1 =
        this.isRecord(body) &&
        typeof body.msg1 === "string"
          ? body.msg1
          : "unknown";

      console.info("[KIS WS] system message received", {
        trId:
          typeof trId === "string"
            ? trId
            : "unknown",
        message: msg1
      });
    } catch {
      console.error(
        "[KIS WS] failed to process message"
      );
    }
  }

  private isRecord(
    value: unknown
  ): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  protected emitTrade(trade: MarketTrade): void {
    this.tradeHandler?.(trade);
  }

  private updateConnectionStatus(
    status: KisConnectionStatus,
    timestamps: Partial<Omit<KisConnectionSnapshot, "status">> = {}
  ): void {
    this.connectionSnapshot = {
      ...this.connectionSnapshot,
      ...timestamps,
      status
    };

    this.connectionStatusHandler?.(this.getConnectionSnapshot());
  }
}
