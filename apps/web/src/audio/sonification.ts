import type { ListeningPreferences, RealtimeTrade, SoundEventLog } from "../types";

type Direction = "up" | "down" | "flat";

export class Sonification {
  private audioContext: AudioContext | null = null;
  private muted = false;
  private volume = 0.15;
  private preferences: ListeningPreferences = {
    mode: "price-volume",
    speed: "normal",
    includeVolume: true,
    thresholdRate: null,
    speechDetailLevel: "medium"
  };

  private previousPrices = new Map<string, number>();
  private eventLevels = new Map<string, number>();
  private lastRollTimes = new Map<string, number>();
  private readonly rollCooldown = 450;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setVolume(volume: number): void {
    this.volume = Math.min(0.4, Math.max(0, volume));
  }

  setPreferences(preferences: ListeningPreferences): void {
    this.preferences = preferences;
  }

  playTrade(trade: RealtimeTrade, stockName = trade.stockName ?? trade.symbol): SoundEventLog | null {
    if (!Number.isFinite(trade.currentPrice)) {
      return null;
    }

    if (
      this.preferences.mode === "alerts-only" &&
      this.preferences.thresholdRate !== null &&
      Math.abs(trade.changeRate) < this.preferences.thresholdRate
    ) {
      return null;
    }

    const soundEvent = this.createSoundEvent(trade, stockName);

    if (this.muted) {
      return soundEvent;
    }

    const context = this.getAudioContext();
    if (context.state === "suspended") {
      void context.resume();
    }

    const symbol = trade.symbol;
    const previousPrice = this.previousPrices.get(symbol) ?? null;

    const nextEventLevel = this.getEventLevel(trade.changeRate);
    const previousEventLevel = this.eventLevels.get(symbol) ?? 0;

    if (nextEventLevel !== 0 && nextEventLevel !== previousEventLevel) {
      const isNewSurge = nextEventLevel > 0 && nextEventLevel > previousEventLevel;
      const isNewDrop = nextEventLevel < 0 && nextEventLevel < previousEventLevel;

      if (isNewSurge || isNewDrop) {
        this.playEventSound(context, nextEventLevel);
      }
    }

    this.eventLevels.set(symbol, nextEventLevel);

    const direction = this.getDirection(trade.currentPrice, previousPrice);
    const frequency = this.getFrequency(trade.currentPrice, previousPrice, direction, trade.changeRate);
    const volumeLevel = this.preferences.includeVolume
      ? this.getTradeVolume(trade.tradeVolume)
      : this.volume;

    this.previousPrices.set(symbol, trade.currentPrice);

    const now = context.currentTime;

    this.playPulse(context, now, frequency, volumeLevel);

    if (this.shouldPlayRollSound(symbol, trade.tradeVolume, now)) {
      const rollCount = this.getRollCount(trade.tradeVolume);
      this.playRollSound(context, now, direction, rollCount);
      this.lastRollTimes.set(symbol, now * 1000);
    }

    return soundEvent;
  }

  private getEventLevel(changeRate: number): number {
    if (changeRate >= 30) return 6;
    if (changeRate >= 25) return 5;
    if (changeRate >= 20) return 4;
    if (changeRate >= 15) return 3;
    if (changeRate >= 10) return 2;
    if (changeRate >= 5) return 1;

    if (changeRate <= -30) return -6;
    if (changeRate <= -25) return -5;
    if (changeRate <= -20) return -4;
    if (changeRate <= -15) return -3;
    if (changeRate <= -10) return -2;
    if (changeRate <= -5) return -1;

    return 0;
  }

  private playEventSound(context: AudioContext, level: number): void {
    const now = context.currentTime;
    const magnitude = Math.min(6, Math.abs(level));
    const isSurge = level > 0;
    const eventVolume = Math.min(0.4, this.volume * (1.05 + magnitude * 0.07));

    const frequencies = isSurge
      ? [660, 780, 920, 1080, 1260]
      : [440, 370, 310, 260, 220];

    const count = magnitude >= 6 ? 5 : magnitude >= 4 ? 4 : magnitude >= 2 ? 3 : 2;

    for (let i = 0; i < count; i += 1) {
      this.playEventPulse(context, now + i * 0.12, frequencies[i]!, eventVolume);
    }
  }

  private playEventPulse(context: AudioContext, startTime: number, frequency: number, volume: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.3);
  }

  private getDirection(currentPrice: number, previousPrice: number | null): Direction {
    if (previousPrice === null) return "flat";
    if (currentPrice > previousPrice) return "up";
    if (currentPrice < previousPrice) return "down";
    return "flat";
  }

  private getFrequency(
    currentPrice: number,
    previousPrice: number | null,
    direction: Direction,
    changeRate: number
  ): number {
    const baseFrequency = 440;
    const tickSize = 250;

    if (direction === "flat" || previousPrice === null) {
      const baseline = Math.max(-2, Math.min(2, changeRate));
      return baseFrequency * Math.pow(2, baseline / 24);
    }

    const priceDelta = Math.abs(currentPrice - previousPrice);
    const tickCount = Math.max(1, Math.min(4, Math.round(priceDelta / tickSize)));
    const semitones = tickCount * 3;

    return direction === "up"
      ? baseFrequency * Math.pow(2, semitones / 12)
      : baseFrequency * Math.pow(2, -semitones / 12);
  }

  private getTradeVolume(tradeVolume: number): number {
    const safeVolume = Math.max(1, tradeVolume);
    const logVolume = Math.log10(safeVolume);
    const normalized = Math.max(0, Math.min(1, logVolume / 4));
    const multiplier = 0.65 + normalized * 0.25;

    return Math.min(0.4, Math.max(0.001, this.volume * multiplier));
  }

  private shouldPlayRollSound(symbol: string, tradeVolume: number, currentTime: number): boolean {
    if (tradeVolume < 30) return false;
    const lastTime = this.lastRollTimes.get(symbol);
    if (lastTime === undefined) return true;

    const elapsed = currentTime * 1000 - lastTime;
    return elapsed >= this.rollCooldown;
  }

  private getRollCount(tradeVolume: number): number {
    const safeVolume = Math.max(1, tradeVolume);
    if (safeVolume >= 1000) return 5;
    if (safeVolume >= 300) return 4;
    if (safeVolume >= 100) return 3;
    if (safeVolume >= 30) return 2;
    return 0;
  }

  private playRollSound(context: AudioContext, startTime: number, direction: Direction, count: number): void {
    const gap = 0.055;
    const baseFrequency = direction === "up" ? 620 : direction === "down" ? 420 : 520;

    for (let i = 0; i < count; i += 1) {
      let frequency = baseFrequency;
      if (direction === "up") {
        frequency = baseFrequency * Math.pow(2, (i * 2) / 12);
      } else if (direction === "down") {
        frequency = baseFrequency * Math.pow(2, -(i * 2) / 12);
      } else {
        const offset = i % 2 === 0 ? 0 : 1;
        frequency = baseFrequency * Math.pow(2, offset / 12);
      }

      this.playRollPulse(context, startTime + i * gap, frequency, this.volume * 0.65);
    }
  }

  private playRollPulse(context: AudioContext, startTime: number, frequency: number, volume: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.045);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.05);
  }

  private playPulse(context: AudioContext, startTime: number, frequency: number, volume: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.12);
  }

  playSample(direction: Direction, volume: "low" | "high" = "low"): void {
    if (this.muted) return;

    const context = this.getAudioContext();
    if (context.state === "suspended") {
      void context.resume();
    }

    const frequency = direction === "up" ? 660 : direction === "down" ? 330 : 440;
    const volumeLevel = volume === "high" ? this.volume : this.volume * 0.45;

    this.playPulse(context, context.currentTime, frequency, volumeLevel);
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private createSoundEvent(trade: RealtimeTrade, stockName: string): SoundEventLog {
    const soundEvent =
      trade.changeRate > 0
        ? "PRICE_UP"
        : trade.changeRate < 0
          ? "PRICE_DOWN"
          : "PRICE_FLAT";

    return {
      soundEvent,
      symbol: trade.symbol,
      stockName,
      createdAt: new Date().toISOString(),
      sourceData: {
        currentPrice: trade.currentPrice,
        changePrice: trade.changePrice,
        changeRate: trade.changeRate,
        tradeVolume: trade.tradeVolume
      },
      mapping: {
        pitch: "priceDirection",
        volume: this.preferences.includeVolume ? "tradeVolume" : "fixed",
        tempo: this.preferences.speed
      }
    };
  }
}