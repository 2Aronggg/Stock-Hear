import type {
  ClientSocketMessage,
  ConnectionStatus,
  ServerSocketMessage
} from "../types";

interface MarketSocketOptions {
  url: string;
  symbol: string;
  onStatusChange: (status: ConnectionStatus) => void;
  onMessage: (message: ServerSocketMessage) => void;
}

export class MarketSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  // 현재 선택된 종목을 기억
  private currentSymbol: string;

  // 사용자가 의도적으로 연결을 종료했는지 여부
  private manuallyDisconnected = false;

  constructor(private readonly options: MarketSocketOptions) {
    this.currentSymbol = options.symbol;
  }

  connect(): void {
    this.manuallyDisconnected = false;
    this.options.onStatusChange("connecting");

    this.socket = new WebSocket(this.options.url);

    this.socket.addEventListener("open", () => {
      this.options.onStatusChange("connected");

      // 최초 연결 또는 재연결 시 현재 선택된 종목 구독
      this.send({
        type: "subscribe",
        symbol: this.currentSymbol
      });
    });

    this.socket.addEventListener("message", (event) => {
      const message = this.parseMessage(event.data);

      if (message) {
        this.options.onMessage(message);
      }
    });

    this.socket.addEventListener("close", () => {
      this.options.onStatusChange("disconnected");

      if (!this.manuallyDisconnected) {
        this.scheduleReconnect();
      }
    });

    this.socket.addEventListener("error", () => {
      this.options.onStatusChange("error");
    });
  }

  subscribe(symbol: string): void {
    this.currentSymbol = symbol;

    this.send({
      type: "subscribe",
      symbol
    });
  }

  unsubscribe(symbol: string): void {
    this.send({
      type: "unsubscribe",
      symbol
    });
  }

  replay(symbol: string, windowSeconds: 60 | 180 | 300): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.currentSymbol = symbol;
    this.send({
      type: "replay",
      symbol,
      windowSeconds
    });

    return true;
  }

  disconnect(): void {
    this.manuallyDisconnected = true;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close();
    this.socket = null;
  }

  private send(message: ClientSocketMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private parseMessage(data: unknown): ServerSocketMessage | null {
    if (typeof data !== "string") {
      return null;
    }

    try {
      return JSON.parse(data) as ServerSocketMessage;
    } catch {
      return null;
    }
  }
}

