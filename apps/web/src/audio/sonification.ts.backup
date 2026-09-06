export interface TradeData {
  currentPrice: number;
  changeRate: number;
  tradeVolume: number;
  tradeStrength?: number;
}

export class Sonification {
  private audioContext: AudioContext;
  private masterGain: GainNode;

  private enabled = true;
  private volume = 0.15;

  // 이벤트음이 너무 자주 발생하지 않도록 cooldown
  private lastEventTime = 0;
  private readonly EVENT_COOLDOWN = 1000;

  // C4 ~ C5의 C major scale
  // 도 레 미 파 솔 라 시 도
  private readonly scale = [
    261.63,
    293.66,
    329.63,
    349.23,
    392.0,
    440.0,
    493.88,
    523.25,
  ];

  constructor() {
    this.audioContext = new AudioContext();

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.volume;

    this.masterGain.connect(this.audioContext.destination);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setMuted(muted: boolean) {
    this.masterGain.gain.value = muted ? 0 : this.volume;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.value = this.volume;
  }

  /**
   * 실시간 체결 데이터를 소리로 변환
   */
  playTrade(trade: TradeData) {
    if (!this.enabled) return;

    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume();
    }

    const frequency = this.getFrequency(trade.changeRate);
    const volume = this.getTradeVolume(trade.tradeVolume);

    // 일반 체결음
    this.playTone(frequency, volume);

    // 특정 이벤트 발생 여부 확인
    this.checkEvent(trade);
  }

  /**
   * ========================================
   * 1 + 2. 등락률 → 비선형 매핑 → 음계
   * ========================================
   *
   * 작은 등락률의 차이가 잘 들리도록
   * 중심 구간(-0.5% ~ +0.5%)을 확대한다.
   *
   * 이후 연속적인 주파수가 아니라
   * C major scale의 음계로 양자화한다.
   */
  private getFrequency(changeRate: number): number {
    // 지나치게 큰 값은 제한
    const MIN_RATE = -10;
    const MAX_RATE = 10;

    const clampedRate = Math.max(
      MIN_RATE,
      Math.min(MAX_RATE, changeRate)
    );

    /*
     * tanh를 이용한 비선형 매핑
     *
     * 0 근처:
     *   작은 변화에도 큰 차이가 발생
     *
     * 양 끝:
     *   변화가 완만해짐
     */
    const nonlinear = Math.tanh(clampedRate / 1.0);

    // -1 ~ +1 → 0 ~ 1
    const normalized = (nonlinear + 1) / 2;

    // 0 ~ 1 → 음계 index
    const index = Math.round(
      normalized * (this.scale.length - 1)
    );

    return this.scale[index] ?? 261.63;
  }

  /**
   * ========================================
   * 3. 거래량 → 음량
   * ========================================
   *
   * 거래량의 범위가 매우 크기 때문에
   * log10으로 압축한다.
   */
  private getTradeVolume(tradeVolume: number): number {
    const MIN_VOLUME = 1;
    const MAX_VOLUME = 100000;

    const clampedVolume = Math.max(
      MIN_VOLUME,
      Math.min(MAX_VOLUME, tradeVolume)
    );

    const normalized =
      Math.log10(clampedVolume) /
      Math.log10(MAX_VOLUME);

    /*
     * 너무 작은 거래량도 완전히 안 들리지 않도록
     * 최소 볼륨을 확보한다.
     */
    const MIN_GAIN = 0.02;
    const MAX_GAIN = 0.25;

    return (
      MIN_GAIN +
      normalized * (MAX_GAIN - MIN_GAIN)
    );
  }

  /**
   * ========================================
   * 일반 체결음
   * ========================================
   */
  private playTone(
    frequency: number,
    volume: number
  ) {
    const now = this.audioContext.currentTime;

    const oscillator =
      this.audioContext.createOscillator();

    const gain =
      this.audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      frequency,
      now
    );

    /*
     * Attack / Release
     *
     * 짧은 체결음이지만 click noise가
     * 발생하지 않도록 smoothing
     */
    gain.gain.setValueAtTime(
      0.001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      volume,
      now + 0.015
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + 0.12
    );

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + 0.13);
  }

  /**
   * ========================================
   * 5. 이벤트음
   * ========================================
   *
   * 일반 체결음과 구분되는 패턴을 재생한다.
   *
   * 이벤트 조건:
   *
   * 1. 등락률 ±2% 이상
   * 2. 체결강도 200% 이상
   */
  private checkEvent(trade: TradeData) {
    const now = Date.now();

    // 이벤트가 너무 자주 발생하지 않도록 제한
    if (
      now - this.lastEventTime <
      this.EVENT_COOLDOWN
    ) {
      return;
    }

    // 급등
    if (trade.changeRate >= 2) {
      this.playEventSound("up");
      this.lastEventTime = now;
      return;
    }

    // 급락
    if (trade.changeRate <= -2) {
      this.playEventSound("down");
      this.lastEventTime = now;
      return;
    }

    // 체결강도 200% 이상
    if (
      trade.tradeStrength !== undefined &&
      trade.tradeStrength >= 200
    ) {
      this.playEventSound("strength");
      this.lastEventTime = now;
    }
  }

  /**
   * 이벤트 패턴음
   */
  private playEventSound(
    type: "up" | "down" | "strength"
  ) {
    const now = this.audioContext.currentTime;

    let notes: number[];

    switch (type) {
      case "up":
        // 상승: 도 → 미 → 솔
        notes = [
          523.25,
          659.25,
          783.99,
        ];
        break;

      case "down":
        // 하락: 솔 → 미 → 도
        notes = [
          392.0,
          329.63,
          261.63,
        ];
        break;

      case "strength":
        // 체결강도: 짧은 반복음
        notes = [
          659.25,
          659.25,
        ];
        break;
    }

    notes.forEach((frequency, index) => {
      const oscillator =
        this.audioContext.createOscillator();

      const gain =
        this.audioContext.createGain();

      const startTime =
        now + index * 0.08;

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
        0.12,
        startTime + 0.01
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        startTime + 0.07
      );

      oscillator.connect(gain);
      gain.connect(this.masterGain);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.08);
    });
  }

  /**
   * ========================================
   * 테스트용 샘플
   * ========================================
   */
  playSample(
  type:
    | "up"
    | "down"
    | "flat"
    | "small-volume"
    | "large-volume"
    | "event",
  sampleVolume?: "low" | "high"
) {
  if (!this.enabled) return;

  if (this.audioContext.state === "suspended") {
    void this.audioContext.resume();
  }

  if (type === "flat" && sampleVolume !== undefined) {
  const volume = sampleVolume === "high" ? 0.2 : 0.04;

  this.playTone(
    this.getFrequency(0),
    volume
  );

  return;
}

  switch (type) {
    case "up":
      this.playTrade({
        currentPrice: 100000,
        changeRate: 3,
        tradeVolume: 50000,
      });
      break;

    case "down":
      this.playTrade({
        currentPrice: 100000,
        changeRate: -3,
        tradeVolume: 50000,
      });
      break;

    case "flat":
      this.playTrade({
        currentPrice: 100000,
        changeRate: 0,
        tradeVolume: 50000,
      });
      break;

    case "small-volume":
      this.playTrade({
        currentPrice: 100000,
        changeRate: 0.3,
        tradeVolume: 10,
      });
      break;

    case "large-volume":
      this.playTrade({
        currentPrice: 100000,
        changeRate: 0.3,
        tradeVolume: 100000,
      });
      break;

    case "event":
      this.playTrade({
        currentPrice: 100000,
        changeRate: 2.5,
        tradeVolume: 50000,
      });
      break;
  }
}
}