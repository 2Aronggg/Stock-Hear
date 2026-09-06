# 파일 및 폴더 역할

MVP에서 팀원이 빠르게 이해하고 수정할 수 있도록 파일 수를 줄인 구조다.

## 루트

- `package.json`: npm workspaces와 전체 실행 명령을 관리한다.
- `package-lock.json`: 팀원이 같은 의존성 버전으로 설치하도록 고정한다.
- `.gitignore`: 환경변수, 빌드 결과물, 의존성, 로그를 Git에서 제외한다.
- `README.md`: 프로젝트 목적, 실행 방법, 문서 링크를 제공한다.
- `tsconfig.base.json`: 프론트엔드와 서버가 공유하는 TypeScript strict 설정이다.

## `apps/web`

사용자가 직접 사용하는 React 앱이다. 한국투자증권에 직접 연결하지 않고 우리 백엔드 WebSocket에만 연결한다.

- `src/App.tsx`
  - MVP 화면의 상태를 관리한다.
  - 선택 종목, 서버 연결 상태, 최신 체결정보, 소리화 설정을 연결한다.

- `src/main.tsx`
  - React 앱 진입점이다.

- `src/styles.css`
  - 전체 스타일, 포커스 표시, 고대비 UI, 스크린리더 전용 클래스를 관리한다.

- `src/types.ts`
  - 프론트엔드에서 사용하는 `RealtimeTrade`, 연결 상태, WebSocket 메시지 타입을 정의한다.
  - 서버의 `RealtimeTrade` 구조와 필드명을 동일하게 유지한다.

### `apps/web/src/components`

- `StockSelector.tsx`
  - 조회할 종목을 선택한다.
  - 선택 변경 시 서버 구독 대상이 바뀐다.

- `MarketDisplay.tsx`
  - 현재가, 등락률, 체결량, 누적거래량, 연결 상태, 마지막 체결시간을 보여준다.
  - 화면낭독기가 이해할 수 있는 텍스트를 함께 제공한다.

- `AudioControls.tsx`
  - 소리 시작, 중지, 음소거, 볼륨 조절, 샘플 소리를 제공한다.

- `VoiceControls.tsx`
  - 사용자가 버튼을 누른 뒤 말하는 방식으로 음성 명령을 실행한다.
  - 현재가, 등락률, 거래량, 소리 시작, 소리 멈춤 명령을 처리한다.

### `apps/web/src/audio`

- `sonification.ts`
  - Web Audio API를 사용한다.
  - 가격은 음높이, 거래량은 음량, 체결빈도는 추후 리듬으로 변환한다.

- `speech.ts`
  - Web Speech API를 사용한다.
  - 음성 인식, 음성 합성, 규칙 기반 명령 해석을 한 파일에서 관리한다.

### `apps/web/src/api`

- `marketSocket.ts`
  - 백엔드 WebSocket 연결, subscribe, unsubscribe, trade 메시지 수신, 재연결을 담당한다.

## `apps/server`

한국투자증권 인증정보를 보호하고 프론트엔드로 실시간 데이터를 중계하는 서버다.

- `src/config.ts`
  - `dotenv`로 환경변수를 읽고 zod로 검증한다.
  - `process.env` 직접 접근은 이 파일에서만 허용한다.

- `src/server.ts`
  - Express 서버를 시작한다.
  - `GET /api/health`를 제공한다.
  - 프론트엔드용 `/ws` WebSocket 서버를 실행한다.
  - subscribe, unsubscribe, ping 메시지를 처리한다.

### `apps/server/src/kis`

- `auth.ts`
  - 한국투자증권 인증, access token, approval key 발급을 구현할 위치다.

- `websocket.ts`
  - 한국투자증권 실시간 WebSocket 연결, 종목 구독, 구독 해제, 재연결을 구현할 위치다.

- `parser.ts`
  - TR ID에 따라 국내·미국 파서를 선택하고 `MarketTrade`를 반환한다.

- `domestic/parser.ts`
  - 국내주식 `H0STCNT0` 원본 체결 메시지를 `MarketTrade`로 변환한다.

- `overseas/parser.ts`
  - 미국주식 `HDFSCNT0` 원본 체결 메시지를 `MarketTrade`로 변환한다.

### `apps/server/src/market`

- `types.ts`
  - 국내·미국 체결 데이터가 함께 사용하는 `MarketTrade` 타입을 정의한다.

- `instruments.ts`
  - 지원 종목의 시장, 거래소, 통화, KIS TR ID와 구독 키를 관리한다.

## `docs`

팀 운영에 필요한 최소 문서만 유지한다.

- `FILE_STRUCTURE.md`
- `DEVELOPMENT_RULES.md`
- `TEAM_CHECKLIST.md`
- `SECURITY_RULES.md`
- `API_INTEGRATION.md`
- `TASKS.md`

