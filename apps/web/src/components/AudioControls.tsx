interface AudioControlsProps {
  enabled: boolean;
  muted: boolean;
  volume: number;
  onEnabledChange: (enabled: boolean) => void;
  onMutedChange: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onSample: (direction: "up" | "down" | "flat") => void;
  onVolumeSample: (volume: "low" | "high") => void;
}

export const AudioControls = ({
  enabled,
  muted,
  volume,
  onEnabledChange,
  onMutedChange,
  onVolumeChange,
  onSample,
  onVolumeSample
}: AudioControlsProps) => (
  <section className="panel audio-controls" aria-labelledby="audio-controls-title">
    <div className="panel-heading">
      <span className="panel-kicker">STEP 02</span>
      <h2 id="audio-controls-title">소리화 제어</h2>
    </div>
    <div className="mixer-stack" aria-label="소리화 매핑 슬라이더">
      <div className="mixer-row">
        <div className="mixer-row-heading">
          <span>음높이</span>
          <output>등락률</output>
        </div>
        <div className="mixer-control">
          <span aria-hidden="true">−</span>
          <input type="range" min="0" max="100" value="58" aria-label="등락률을 음높이로 변환" disabled />
          <span aria-hidden="true">+</span>
        </div>
      </div>
      <div className="mixer-row">
        <div className="mixer-row-heading">
          <span>세기</span>
          <output>{Math.round(volume * 250)}%</output>
        </div>
        <div className="mixer-control">
          <span aria-hidden="true">low</span>
          <input
            type="range"
            min="0"
            max="0.4"
            step="0.01"
            value={volume}
            aria-label="체결량 소리 세기"
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
          <span aria-hidden="true">high</span>
        </div>
      </div>
      <div className="mixer-row">
        <div className="mixer-row-heading">
          <span>길이</span>
          <output>속도 설정</output>
        </div>
        <div className="mixer-control">
          <span aria-hidden="true">짧게</span>
          <input type="range" min="0" max="100" value="50" aria-label="청취 속도를 소리 길이로 변환" disabled />
          <span aria-hidden="true">길게</span>
        </div>
      </div>
    </div>
    <div className="button-row">
      <button type="button" aria-pressed={enabled} onClick={() => onEnabledChange(!enabled)}>
        {enabled ? "소리 중지" : "소리 시작"}
      </button>
      <button className="secondary-button" type="button" aria-pressed={muted} onClick={() => onMutedChange(!muted)}>
        {muted ? "음소거 해제" : "음소거"}
      </button>
    </div>
    <div className="button-row" aria-label="등락 소리 샘플">
      <button className="sample-button up" type="button" onClick={() => onSample("up")}>
        상승음
      </button>
      <button className="sample-button down" type="button" onClick={() => onSample("down")}>
        하락음
      </button>
      <button className="sample-button flat" type="button" onClick={() => onSample("flat")}>
        보합음
      </button>
    </div>
    <div className="button-row" aria-label="거래량 소리 샘플">
      <button className="ghost-button" type="button" onClick={() => onVolumeSample("low")}>
        적은 거래량
      </button>
      <button className="ghost-button" type="button" onClick={() => onVolumeSample("high")}>
        많은 거래량
      </button>
    </div>
  </section>
);
