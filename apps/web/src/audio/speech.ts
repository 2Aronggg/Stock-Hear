export type VoiceCommand =
  | "read-price"
  | "read-change-rate"
  | "read-volume"
  | "start-sound"
  | "stop-sound"
  | "unknown";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export const parseVoiceCommand = (transcript: string): VoiceCommand => {
  const normalized = transcript.trim().replace(/\s+/g, "");

  if (normalized.includes("현재가") || normalized.includes("가격")) {
    return "read-price";
  }

  if (normalized.includes("등락률") || normalized.includes("변동률")) {
    return "read-change-rate";
  }

  if (normalized.includes("거래량")) {
    return "read-volume";
  }

  if (normalized.includes("소리시작") || normalized.includes("재생")) {
    return "start-sound";
  }

  if (normalized.includes("소리멈춰") || normalized.includes("정지")) {
    return "stop-sound";
  }

  return "unknown";
};

export const speak = (text: string): void => {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

export const listenOnce = (onTranscript: (transcript: string) => void, onEnd: () => void): boolean => {
  const speechWindow = window as SpeechWindow;
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  if (!Recognition) {
    return false;
  }

  const recognition = new Recognition();
  recognition.lang = "ko-KR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    onTranscript(event.results[0]?.[0]?.transcript ?? "");
  };
  recognition.onend = onEnd;
  recognition.start();

  return true;
};

