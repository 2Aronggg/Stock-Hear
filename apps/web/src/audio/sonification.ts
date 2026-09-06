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

  // 종목별 이전 가격
  private previousPrices = new Map<string, number>();

  // 종목별 급등락 threshold 레벨
  //
  //  0  = normal
  //  1  = +5%
  //  2  = +10%
  //  3  = +15%
  //  4  = +20%
  //  5  = +25%
  //  6  = +30%
  //
  // -1  = -5%
  // -2  = -10%
  // -3  = -15%
  // -4  = -20%
  // -5  = -25%
  // -6  = -30%
  private eventLevels = new Map<string, number>();

  // 종목별 거래량 강조음 마지막 재생 시각
  private lastRollTimes = new Map<string, number>();

  // 거래량 강조음이 너무 자주 반복되지 않도록 하는 간격
  private readonly rollCooldown = 450;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setVolume(volume: number): void {
    this.volume = Math.min(0.4, Math.max(0, volume));
  }

<<<<<<< HEAD:stock-hear/apps/web/src/audio/sonification.ts
  playTrade(trade: RealtimeTrade): void {
    if (
      this.muted ||
      !Number.isFinite(trade.currentPrice)
    ) {
      return;
=======
  setPreferences(preferences: ListeningPreferences): void {
    this.preferences = preferences;
  }

  playTrade(trade: RealtimeTrade, stockName = trade.stockName ?? trade.symbol): SoundEventLog | null {
    console.log(
      "[SONIFICATION]",
      "등락률:",
      trade.changeRate,
      "거래량:",
      trade.tradeVolume,
      "현재가:",
      trade.currentPrice
    );

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
>>>>>>> upstream/dev:apps/web/src/audio/sonification.ts
    }

    const context = this.getAudioContext();

    if (context.state === "suspended") {
      void context.resume();
    }

    const symbol = trade.symbol;

    /*
     * =========================
     * 1. 종목별 이전 가격 가져오기
     * =========================
     */
    const previousPrice =
      this.previousPrices.get(symbol) ?? null;

<<<<<<< HEAD:stock-hear/apps/web/src/audio/sonification.ts
    /*
     * =========================
     * 2. 급등락 이벤트 확인
     * =========================
     *
     * 등락률을 5% 단위로 구간화한다.
     *
     * +5%   → level 1
     * +10%  → level 2
     * +15%  → level 3
     * +20%  → level 4
     * +25%  → level 5
     * +30%  → level 6
     *
     * -5%   → level -1
     * -10%  → level -2
     * -15%  → level -3
     * -20%  → level -4
     * -25%  → level -5
     * -30%  → level -6
     *
     * 같은 구간 안에서는 이벤트음을
     * 반복하지 않는다.
     */
    const nextEventLevel =
      this.getEventLevel(trade.changeRate);
=======
    // 체결량 → 음량
    const volume = this.preferences.includeVolume
      ? this.getTradeVolume(trade.tradeVolume)
      : this.volume;
>>>>>>> upstream/dev:apps/web/src/audio/sonification.ts

    const previousEventLevel =
      this.eventLevels.get(symbol) ?? 0;

    /*
     * 새로운 threshold를 돌파했을 때만
     * 급등락 이벤트음을 재생한다.
     *
     * 예:
     *
     * +4.9 → +5.1   🔔
     * +5.1 → +8.0   -
     * +8.0 → +10.1  🔔
     *
     * 반대로 threshold가 낮아지는 경우에는
     * 이벤트음을 내지 않는다.
     *
     * +10 → +8       -
     * +8  → +5       -
     *
     * 다시 +10을 돌파하면
     * 이전 레벨이 1이므로 다시 이벤트음 발생.
     */
    if (
      nextEventLevel !== 0 &&
      nextEventLevel !== previousEventLevel
    ) {
      const isNewSurge =
        nextEventLevel > 0 &&
        nextEventLevel > previousEventLevel;

      const isNewDrop =
        nextEventLevel < 0 &&
        nextEventLevel < previousEventLevel;

      if (isNewSurge || isNewDrop) {
        this.playEventSound(
          context,
          nextEventLevel
        );
      }
    }

    // 현재 이벤트 레벨 저장
    this.eventLevels.set(
      symbol,
      nextEventLevel
    );

    /*
     * =========================
     * 3. 일반 체결음
     * =========================
     */
    const direction = this.getDirection(
      trade.currentPrice,
      previousPrice
    );

    const frequency = this.getFrequency(
      trade.currentPrice,
      previousPrice,
      direction,
      trade.changeRate
    );

    /*
     * 거래량 자체를 음량으로 크게
     * 차이나게 만들지 않고,
     * 거래량의 차이는 roll sound로 표현한다.
     */
    const volumeLevel =
      this.getTradeVolume(
        trade.tradeVolume
      );

    /*
     * 이전 가격 저장
     */
    this.previousPrices.set(
      symbol,
      trade.currentPrice
    );

    const now = context.currentTime;
<<<<<<< HEAD:stock-hear/apps/web/src/audio/sonification.ts
=======
    const duration = this.getDuration();
>>>>>>> upstream/dev:apps/web/src/audio/sonification.ts

    /*
     * 일반 체결음
     */
    this.playPulse(
      context,
      now,
      frequency,
      volumeLevel
    );

    /*
     * =========================
     * 4. 거래량 강조음
     * =========================
     *
     * 거래량이 일정 수준 이상이면
     * 짧은 "또르륵" 소리를 추가한다.
     *
     * 실시간 체결 데이터가 매우 빠르게
     * 들어오는 경우 cooldown을 적용한다.
     */
    if (
      this.shouldPlayRollSound(
        symbol,
        trade.tradeVolume,
        now
      )
    ) {
      const rollCount =
        this.getRollCount(
          trade.tradeVolume
        );

      this.playRollSound(
        context,
        now,
        direction,
        rollCount
      );

      this.lastRollTimes.set(
        symbol,
        now * 1000
      );
    }
  }

  /*
   * =========================
   * 급등락 이벤트 레벨
   * =========================
   *
   * 5% 단위로 threshold를 나눈다.
   *
   * +5%   → 1
   * +10%  → 2
   * +15%  → 3
   * +20%  → 4
   * +25%  → 5
   * +30%  → 6
   *
   * -5%   → -1
   * -10%  → -2
   * -15%  → -3
   * -20%  → -4
   * -25%  → -5
   * -30%  → -6
   */
  private getEventLevel(
    changeRate: number
  ): number {
    if (changeRate >= 30) {
      return 6;
    }

    if (changeRate >= 25) {
      return 5;
    }

    if (changeRate >= 20) {
      return 4;
    }

    if (changeRate >= 15) {
      return 3;
    }

    if (changeRate >= 10) {
      return 2;
    }

    if (changeRate >= 5) {
      return 1;
    }

    if (changeRate <= -30) {
      return -6;
    }

    if (changeRate <= -25) {
      return -5;
    }

    if (changeRate <= -20) {
      return -4;
    }

    if (changeRate <= -15) {
      return -3;
    }

    if (changeRate <= -10) {
      return -2;
    }

    if (changeRate <= -5) {
      return -1;
    }

    return 0;
  }

  /*
   * =========================
   * 급등락 이벤트음
   * =========================
   *
   * level이 높을수록
   * 강조 정도를 조금씩 높인다.
   *
   * 상승:
   * +5%   → 2음
   * +10%  → 3음
   * +15%  → 3음
   * +20%  → 4음
   * +25%  → 4음
   * +30%  → 5음
   *
   * 하락도 동일한 구조.
   */
  private playEventSound(
    context: AudioContext,
    level: number
  ): void {
    const now = context.currentTime;

    const magnitude =
      Math.min(
        6,
        Math.abs(level)
      );

    const isSurge = level > 0;

    /*
     * level이 높아질수록
     * 이벤트음의 음량을 조금 증가시킨다.
     */
    const eventVolume = Math.min(
      0.4,
      this.volume *
        (1.05 + magnitude * 0.07)
    );

    /*
     * 상승 이벤트음
     */
    if (isSurge) {
      const frequencies = [
        660,
        780,
        920,
        1080,
        1260,
      ];

      const count =
        magnitude >= 6
          ? 5
          : magnitude >= 4
            ? 4
            : magnitude >= 2
              ? 3
              : 2;

      for (
        let i = 0;
        i < count;
        i += 1
      ) {
        this.playEventPulse(
          context,
          now + i * 0.12,
          frequencies[i]!,
          eventVolume
        );
      }

      return;
    }

    /*
     * 하락 이벤트음
     */
    const frequencies = [
      440,
      370,
      310,
      260,
      220,
    ];

    const count =
      magnitude >= 6
        ? 5
        : magnitude >= 4
          ? 4
          : magnitude >= 2
            ? 3
            : 2;

    for (
      let i = 0;
      i < count;
      i += 1
    ) {
      this.playEventPulse(
        context,
        now + i * 0.12,
        frequencies[i]!,
        eventVolume
      );
    }
  }

  /*
   * =========================
   * 이벤트음 개별 Pulse
   * =========================
   */
  private playEventPulse(
    context: AudioContext,
    startTime: number,
    frequency: number,
    volume: number
  ): void {
    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type = "triangle";

    oscillator.frequency.setValueAtTime(
      frequency,
      startTime
    );

    gain.gain.setValueAtTime(
      0.001,
      startTime
    );

    gain.gain.exponentialRampToValueAtTime(
      Math.max(
        0.001,
        volume
      ),
      startTime + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      startTime + 0.28
    );

    oscillator.connect(gain);
<<<<<<< HEAD:stock-hear/apps/web/src/audio/sonification.ts
    gain.connect(
      context.destination
    );

    oscillator.start(
      startTime
=======
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);

    return soundEvent;
  }

  playSample(
    direction: "up" | "down" | "flat",
    volume: "low" | "high" = "low"
  ): void {
    const sampleTrade: RealtimeTrade = {
      market: "KR",
      exchange: "DEMO",
      symbol: "SAMPLE",
      stockName: "샘플",
      currency: "KRW",
      tradeTime: "000000",
      currentPrice: 10000,

      changePrice:
        direction === "up"
          ? 100
          : direction === "down"
            ? -100
            : 0,

      changeRate:
        direction === "up"
          ? 1.2
          : direction === "down"
            ? -1.2
            : 0,

      tradeVolume:
        volume === "high"
          ? 1_000_000
          : 1_000,

      accumulatedVolume: 1_000_000,
      receivedAt: new Date().toISOString()
    };

    this.playTrade(sampleTrade, "샘플");
  }

  /**
   * 등락률 → 주파수
   *
   * -10% → 190Hz
   *  -5% → 315Hz
   *   0% → 440Hz
   *  +5% → 565Hz
   * +10% → 690Hz
   *
   * 기존보다 범위를 넓혀서
   * 실제 대형주에서도 등락 방향을 구분하기 쉽도록 한다.
   */
  private getFrequency(changeRate: number): number {
    const clampedRate = Math.max(
      -10,
      Math.min(10, changeRate)
    );

    return 440 + clampedRate * 25;
  }

  private getDuration(): number {
    if (this.preferences.speed === "slow") {
      return 0.24;
    }

    if (this.preferences.speed === "fast") {
      return 0.08;
    }

    return 0.12;
  }

  /**
   * 체결량 → 음량
   *
   * 실제 KIS 데이터의 tradeVolume은
   * 1, 5, 75, 533, 19305처럼 범위가 매우 크다.
   *
   * 따라서 선형 스케일 대신 log10을 사용한다.
   */
  private getTradeVolume(tradeVolume: number): number {
    const safeVolume = Math.max(1, tradeVolume);

    const logVolume = Math.log10(safeVolume);

    const normalizedVolume = Math.min(
      1,
      logVolume / 5
>>>>>>> upstream/dev:apps/web/src/audio/sonification.ts
    );

    oscillator.stop(
      startTime + 0.3
    );
  }

  /*
   * =========================
   * 상승 / 하락 / 보합
   * =========================
   */
  private getDirection(
    currentPrice: number,
    previousPrice: number | null
  ): Direction {
    if (previousPrice === null) {
      return "flat";
    }

    if (
      currentPrice >
      previousPrice
    ) {
      return "up";
    }

    if (
      currentPrice <
      previousPrice
    ) {
      return "down";
    }

    return "flat";
  }

  /*
   * =========================
   * 일반 체결음 음높이
   * =========================
   */
  private getFrequency(
    currentPrice: number,
    previousPrice: number | null,
    direction: Direction,
    changeRate: number
  ): number {
    const baseFrequency = 440;
    const tickSize = 250;

    if (
      direction === "flat" ||
      previousPrice === null
    ) {
      const baseline = Math.max(
        -2,
        Math.min(
          2,
          changeRate
        )
      );

      return (
        baseFrequency *
        Math.pow(
          2,
          baseline / 24
        )
      );
    }

    const priceDelta =
      Math.abs(
        currentPrice -
          previousPrice
      );

    const tickCount =
      Math.max(
        1,
        Math.min(
          4,
          Math.round(
            priceDelta /
              tickSize
          )
        )
      );

    const semitones =
      tickCount * 3;

    if (
      direction === "up"
    ) {
      return (
        baseFrequency *
        Math.pow(
          2,
          semitones / 12
        )
      );
    }

    return (
      baseFrequency *
      Math.pow(
        2,
        -semitones / 12
      )
    );
  }

  /*
   * =========================
   * 거래량 → 일반 체결음 볼륨
   * =========================
   *
   * 거래량에 따른 볼륨 차이는
   * 크게 만들지 않는다.
   *
   * 거래량의 핵심 정보는
   * roll sound가 담당한다.
   */
  private getTradeVolume(
    tradeVolume: number
  ): number {
    const safeVolume =
      Math.max(
        1,
        tradeVolume
      );

    const logVolume =
      Math.log10(
        safeVolume
      );

    const normalized =
      Math.max(
        0,
        Math.min(
          1,
          logVolume / 4
        )
      );

    const multiplier =
      0.65 +
      normalized * 0.25;

    return Math.min(
      0.4,
      Math.max(
        0.001,
        this.volume *
          multiplier
      )
    );
  }

  /*
   * =========================
   * 거래량 → 또르륵 발생 여부
   * =========================
   *
   * 거래량 30 미만에서는
   * 발생하지 않는다.
   */
  private shouldPlayRollSound(
    symbol: string,
    tradeVolume: number,
    currentTime: number
  ): boolean {
    if (
      tradeVolume < 30
    ) {
      return false;
    }

    const lastTime =
      this.lastRollTimes.get(
        symbol
      );

    if (
      lastTime === undefined
    ) {
      return true;
    }

    const elapsed =
      currentTime * 1000 -
      lastTime;

    return (
      elapsed >=
      this.rollCooldown
    );
  }

  /*
   * =========================
   * 거래량 → 또르륵 음 개수
   * =========================
   *
   * 30   ~ 99   → 2음
   * 100  ~ 299  → 3음
   * 300  ~ 999  → 4음
   * 1000 이상   → 5음
   */
  private getRollCount(
    tradeVolume: number
  ): number {
    const safeVolume =
      Math.max(
        1,
        tradeVolume
      );

    if (
      safeVolume >= 1000
    ) {
      return 5;
    }

    if (
      safeVolume >= 300
    ) {
      return 4;
    }

    if (
      safeVolume >= 100
    ) {
      return 3;
    }

    if (
      safeVolume >= 30
    ) {
      return 2;
    }

    return 0;
  }

  /*
   * =========================
   * 거래량 또르륵 효과음
   * =========================
   *
   * 거래량이 클수록
   * 짧은 음을 더 많이 연속해서 재생한다.
   *
   * 상승 → 점점 높은 음
   * 하락 → 점점 낮은 음
   * 보합 → 짧은 패턴
   */
  private playRollSound(
    context: AudioContext,
    startTime: number,
    direction: Direction,
    count: number
  ): void {
    const gap = 0.055;

    const baseFrequency =
      direction === "up"
        ? 620
        : direction === "down"
          ? 420
          : 520;

    for (
      let i = 0;
      i < count;
      i += 1
    ) {
      let frequency =
        baseFrequency;

      if (
        direction === "up"
      ) {
        frequency =
          baseFrequency *
          Math.pow(
            2,
            (i * 2) / 12
          );
      } else if (
        direction === "down"
      ) {
        frequency =
          baseFrequency *
          Math.pow(
            2,
            -(i * 2) / 12
          );
      } else {
        /*
         * 보합에서는 살짝 위아래로
         * 움직여 단순 반복음과 구분한다.
         */
        const offset =
          i % 2 === 0
            ? 0
            : 1;

        frequency =
          baseFrequency *
          Math.pow(
            2,
            offset / 12
          );
      }

      this.playRollPulse(
        context,
        startTime +
          i * gap,
        frequency,
        this.volume * 0.65
      );
    }
  }

  /*
   * =========================
   * 또르륵 개별 음
   * =========================
   */
  private playRollPulse(
    context: AudioContext,
    startTime: number,
    frequency: number,
    volume: number
  ): void {
    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      frequency,
      startTime
    );

    gain.gain.setValueAtTime(
      0.001,
      startTime
    );

    gain.gain.exponentialRampToValueAtTime(
      Math.max(
        0.001,
        volume
      ),
      startTime + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      startTime + 0.045
    );

    oscillator.connect(gain);
    gain.connect(
      context.destination
    );

    oscillator.start(
      startTime
    );

    oscillator.stop(
      startTime + 0.05
    );
  }

  /*
   * =========================
   * 일반 체결음
   * =========================
   */
  private playPulse(
    context: AudioContext,
    startTime: number,
    frequency: number,
    volume: number
  ): void {
    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      frequency,
      startTime
    );

    gain.gain.setValueAtTime(
      0.001,
      startTime
    );

    gain.gain.exponentialRampToValueAtTime(
      Math.max(
        0.001,
        volume
      ),
      startTime + 0.012
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      startTime + 0.11
    );

    oscillator.connect(gain);
    gain.connect(
      context.destination
    );

    oscillator.start(
      startTime
    );

    oscillator.stop(
      startTime + 0.12
    );
  }

  /*
   * =========================
   * 테스트용 샘플
   * =========================
   */
  playSample(
    direction: Direction,
    volume: "low" | "high" = "low"
  ): void {
    if (this.muted) {
      return;
    }

    const context =
      this.getAudioContext();

    if (
      context.state ===
      "suspended"
    ) {
      void context.resume();
    }

    const frequency =
      direction === "up"
        ? 660
        : direction === "down"
          ? 330
          : 440;

    const volumeLevel =
      volume === "high"
        ? this.volume
        : this.volume * 0.45;

    this.playPulse(
      context,
      context.currentTime,
      frequency,
      volumeLevel
    );
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext =
        new AudioContext();
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
