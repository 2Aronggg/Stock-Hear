<<<<<<< HEAD
# Stock-hear

시각장애인을 위한 **실시간 주식정보 음성·음향 변환 서비스**입니다.

한국투자증권 Open API를 통해 국내주식 실시간 체결정보를 수신하고,
현재가·등락률·거래량·체결 흐름을 **화면, 음성(TTS), 소리화(Sonification)** 방식으로 전달합니다.

Stock-Hear는 기존의 시각 중심 주식정보 서비스를 보완하여, 시각장애인 사용자가 실시간 시장 변화를 청각적으로 인지할 수 있도록 설계되었습니다.

또한 사용자가 정해진 명령어를 외우지 않고 자연스럽게 말할 수 있도록 **AI Sonification Planner**를 적용하여 자연어 입력을 실제 소리화 실행 조건으로 변환합니다.

![Stock-Hear 서비스 미리보기](docs/images/02-core-concept.png)

실제 서비스 화면:

![Stock-Hear 실제 서비스 화면](docs/images2/10-service-preview.png)

---

# 1. Project Overview

## 문제 정의

기존 주식 서비스는 차트, 색상, 숫자 등 시각정보에 크게 의존하기 때문에 시각장애인이 실시간 시장 변화를 직관적으로 파악하는 데 한계가 있습니다.

Stock-Hear는 주식 데이터를 단순히 음성으로 읽어주는 것에서 더 나아가, 가격과 거래량, 체결 흐름 자체를 **청각적 패턴으로 변환**하여 전달합니다.

![기존 서비스 대비 Stock-Hear 문제 정의](docs/images/01-problem-definition.png)

## 핵심 목표

- 실시간 주식정보의 비시각적 전달
- 시각장애인 사용자를 고려한 접근 가능한 UI 제공
- 시장 변화를 소리 패턴으로 직관적으로 표현
- 음성 명령을 통한 서비스 제어
- 자연어 기반의 유연한 소리화 요청 지원
- 복잡한 투자 기능보다 정보 접근성에 집중

## 서비스 범위

Stock-Hear는 주식 거래 또는 투자 자문 서비스가 아닙니다.

다음 기능은 제공하지 않습니다.

- 매수
- 매도
- 계좌조회
- 자동매매
- 종목추천
- 투자추천
- 주가 예측

AI 역시 투자 판단이나 시장 예측에는 사용하지 않습니다.

---

# 2. Core Features

## 2.1 실시간 주식 데이터 수신

한국투자증권 KIS Open API와 WebSocket을 이용하여 국내주식 실시간 체결정보를 수신합니다.

### 주요 기능

- KIS Access Token 발급 및 관리
- Approval Key 발급 및 관리
- 한국투자증권 실시간 WebSocket 연결
- 종목별 데이터 구독 및 구독 해제
- 중복 구독 방지
- 연결 상태 관리
- 연결 종료 시 재연결
- 실시간 체결 메시지 파싱
- 체결 데이터를 내부 데이터 형식으로 정규화
- 프론트엔드로 실시간 데이터 전달

![중복 구독 방지·구독 통합 관리·연결 상태 관리](docs/images/06-realtime-stability.png)

### 데이터 흐름

```text
사용자 종목 선택
↓
Frontend
↓
Backend 구독 요청
↓
KIS WebSocket
↓
실시간 체결 데이터
↓
Backend Parser
↓
RealtimeTrade
↓
Frontend WebSocket
```

![실시간 데이터 수신 3단계: 종목 선택 → 구독 요청 → 실시간 수신](docs/images/05-realtime-data-flow.png)

KIS 인증정보와 토큰은 모두 백엔드에서 관리하며 프론트엔드에는 노출하지 않습니다.

---

## 2.2 실시간 주식 데이터 소리화

Web Audio API를 이용하여 실시간 체결정보를 소리로 변환합니다.

AI가 직접 새로운 소리를 생성하거나 소리화 규칙을 변경하는 것이 아니라, 사전에 정의한 **고정 소리화 엔진**을 통해 시장정보를 일관된 방식으로 전달합니다.

![소리화 제어 UI - 음높이, 세기, 속도 설정](docs/images/08-sonification-ui.png)

### 기본 소리화 규칙

```text
가격 변화
↓
음높이 변화

거래량
↓
음량 변화

체결빈도
↓
리듬 변화
```

### 주요 기능

- 실시간 체결 데이터 기반 소리 출력
- 가격 변화의 음높이 변환
- 거래량의 음량 변환
- 체결빈도의 리듬 변환
- 소리 시작 / 중지
- 음소거
- 볼륨 조절
- 실시간 이벤트 기반 음향 출력

![실시간 음향 처리 및 이벤트 설계: 반복 제어(450ms Cooldown), 이벤트 감지(±5% Threshold), 실시간 음향 생성(Web Audio API)](docs/images/09-audio-event-design.png)

> 소리화 데모 영상: https://youtu.be/BrqKv_tZWSg

---

## 2.3 음성 명령 및 TTS 안내

Web Speech API를 이용하여 음성 입력과 음성 안내 기능을 제공합니다.

사용자의 요청은 크게 **실제 데이터를 소리로 듣는 요청**과 **정보를 음성으로 안내받는 요청**으로 구분됩니다.

### TTS 정보 조회 예시

```text
"삼성전자 현재가 알려줘"
→ 현재가를 TTS로 안내

"등락률 얼마야?"
→ 등락률을 TTS로 안내

"거래량 얼마야?"
→ 거래량을 TTS로 안내
```

### 서비스 제어 예시

```text
"소리 그만"
→ 소리화 중지

"다 멈춰"
→ 소리화 중지

"천천히 들려줘"
→ 설정 변경 후 TTS로 적용 결과 안내
```

---

## 2.4 Replay

사용자가 실시간으로 지나간 시장 흐름을 다시 들을 수 있도록 Replay 기능을 제공합니다.

### 예시

```text
"방금 움직임 다시 들려줘"
→ REPLAY_LAST

"최근 1분을 들려줘"
→ REPLAY_RECENT
```

실시간 데이터와 Replay 데이터 모두 동일한 고정 소리화 엔진을 사용합니다.

또한 실시간 시장 이벤트와 실제 소리화 이벤트를 분리하여 관리할 수 있도록 `MarketEvent`, `Replay Buffer`, `SoundEventLog` 구조를 활용합니다.

---

## 2.5 접근성 지원

접근성은 Stock-Hear의 부가 기능이 아니라 핵심 요구사항입니다.

### 주요 기능

- 키보드 기반 조작
- 화면낭독기 친화적 UI
- 현재가·등락률·거래량 텍스트 제공
- 음성 기반 정보 전달
- 소리 기반 시장정보 전달
- 서비스 연결 상태 및 상태 정보 제공
- 시각정보에만 의존하지 않는 인터페이스 구성

Stock-Hear는 동일한 시장정보를 **화면 + 음성 + 소리**의 여러 방식으로 제공하는 것을 목표로 합니다.

---

# 3. AI Sonification Planner

Stock-Hear에서 AI는 주가를 예측하거나 새로운 소리를 생성하는 데 사용하지 않습니다.

AI의 핵심 역할은 **사용자의 자유로운 자연어 입력을 기존 소리화 시스템이 실행할 수 있는 형태로 해석하는 것**입니다.

즉,

```text
AI
= 사용자의 말을 이해하고 실행 계획을 만드는 역할

Sonification Engine
= 실제 데이터를 소리로 변환하는 역할
```

로 분리했습니다.

## AI 적용 기능

AI는 크게 세 가지 부분에 적용했습니다.

---

## 3.1 자연어 입력 이해

기존 키워드 기반 음성 인터페이스에서 확장하여 사용자가 정해진 문장을 정확히 말하지 않아도 자연스러운 발화를 이해할 수 있도록 구성했습니다.

예를 들어,

```text
"삼성전자 들려줘"
→ START_REALTIME

"거래량까지 들려줘"
→ 기존 실시간 소리화 조건에 거래량 추가

"등락률을 소리로 들려줘"
→ 등락률 데이터를 즉시 1회 소리화
```

AI는 자연어에서 다음과 같은 조건을 추출합니다.

- 종목
- 기간
- 소리화 대상
- 재생 방식
- 데이터 소스
- 재생 순서

---

## 3.2 Multi-turn Context

한 번의 발화에 필요한 정보가 모두 포함되지 않은 경우 AI가 추가 질문을 통해 부족한 정보를 보완합니다.

예를 들어,

```text
User
"삼성전자 들려줘"

AI
"가격, 거래량, 큰 변화 중 어떤 정보를 들으시겠어요?"

User
"거래량"

→ 이전 대화의 '삼성전자' 정보를 유지
→ 거래량 조건 추가
→ 소리화 실행
```

즉, 사용자의 각각의 발화를 독립적으로 처리하는 것이 아니라 이전 대화의 맥락을 유지하면서 필요한 조건을 채웁니다.

---

## 3.3 모호한 명령 및 음성 오인식 대응

음성 입력은 종목명이나 명령이 잘못 인식될 가능성이 있기 때문에, 불확실한 상황에서 바로 명령을 실행하지 않도록 구성했습니다.

### 종목명이 모호한 경우

```text
"삼성전자 맞나요?"
```

### 소리화 모드가 지정되지 않은 경우

```text
"가격, 거래량, 큰 변화 중 어떤 정보를 들으시겠어요?"
```

### 발화를 제대로 이해하지 못한 경우

```text
"다시 말씀해 주세요."
```

이를 통해 잘못 인식된 음성 명령이 즉시 실행되는 것을 줄이고 사용자의 실제 의도를 확인할 수 있도록 했습니다.

---

## Sonification Planner 처리 흐름

사용자의 자유질의는 먼저 AI Sonification Planner를 거칩니다.

![자연어 기반 청취 조건 설정: 의도 분석 및 계획 → 데이터 처리 → 소리화 및 후처리](docs/images/07-ai-listening-condition.png)

```text
사용자 자유질의
↓
AI Sonification Planner
↓
사용자 의도 분석
↓
SonificationPlan 생성
↓
필수 슬롯 검사
├─ 부족
│ ↓
│ Multi-turn 질문
│
└─ 충족
↓
데이터 소스 선택
├─ 실시간 WebSocket
├─ Replay Buffer
└─ SoundEventLog
↓
종목 · 기간 · 필터 · 재생 순서 적용
↓
기존 고정 소리화 엔진
↓
소리 출력
↓
MarketEvent + SoundEventLog
```

AI Sonification Planner가 자연어 요청을 구조화한 뒤에는 기존 시스템의 데이터 처리 및 소리화 엔진을 그대로 사용합니다.

---

## Sonification 요청

사용자가 실제 시장 데이터를 **소리로 듣고 싶은 경우**입니다.

| 사용자 요청 | 처리 |
|---|---|
| "삼성전자 들려줘" | `START_REALTIME` |
| "거래량까지 들려줘" | 실시간 소리화 조건 변경 |
| "소리 그만" | 소리화 중지 |
| "다 멈춰" | 소리화 중지 |
| "방금 움직임 다시 들려줘" | `REPLAY_LAST` |
| "최근 1분을 들려줘" | `REPLAY_RECENT` |
| "등락률을 소리로 들려줘" | 즉시 1회 소리화 |

---

## TTS 요청

사용자가 실제 소리가 아니라 정보를 **말로 안내받고 싶은 경우**입니다.

| 사용자 요청 | 처리 |
|---|---|
| "삼성전자 현재가 알려줘" | 현재가 TTS |
| "등락률 얼마야?" | 등락률 TTS |
| "거래량 얼마야?" | 거래량 TTS |
| "방금 무슨 소리였어?" | 직전 소리의 의미 설명 |
| "천천히 들려줘" | 설정 변경 후 확인 TTS |
| 종목명이 모호한 경우 | 종목 확인 질문 |
| 모드가 없는 경우 | 추가 조건 질문 |
| 음성 인식 실패 | 재입력 요청 |

특히 다음 두 명령은 서로 다른 의미로 처리합니다.

```text
"방금 움직임 다시 들려줘"
→ 실제 소리를 다시 재생
→ REPLAY_LAST

"방금 무슨 소리였어?"
→ 직전 소리가 의미한 내용을 TTS로 설명
```

즉, **재생과 설명을 구분**하여 처리합니다.

---

# 4. System Architecture

전체 시스템은 크게 다음 영역으로 구성됩니다.

- Frontend
- Backend
- 한국투자증권 KIS Open API
- AI Sonification Planner
- Sonification Engine

## 전체 구조

![전체 시스템 구조: React Frontend / Node.js Server / KIS Open API](docs/images/03-system-overview.png)

```text
User
│
│ 자연어 / 버튼 입력
▼
React / Vite
Frontend
│
REST / WebSocket
│
▼
Express Backend Server
│
┌──────────┴──────────┐
│ │
▼ ▼
KIS Data Pipeline AI Sonification Planner
│ │
│ SonificationPlan
│ │
└──────────┬──────────┘
│
▼
Data Source / Event Data
│
┌──────────┼──────────┐
│ │ │
▼ ▼ ▼
WebSocket Replay SoundEventLog
│
▼
기존 고정
Sonification Engine
│
▼
Sound Output

▲
│
REST / WebSocket
│
한국투자증권 KIS
Open API
```

![상세 아키텍처 다이어그램: Frontend, Backend(Express + WebSocket), AI Sonification Planner, KIS Open API 데이터 흐름](docs/images/image.png)

---

## Frontend

React / Vite 기반의 사용자 인터페이스입니다.

### 주요 역할

- 종목 선택
- 실시간 시장정보 표시
- 현재가·등락률·거래량 표시
- Backend WebSocket 연결
- 실시간 데이터 수신
- Web Audio API 기반 소리 출력
- Web Speech API 기반 음성 입력
- TTS 안내
- 키보드 접근성
- 화면낭독기 접근성
- 서비스 상태 표시

프론트엔드는 한국투자증권 Open API와 직접 연결하지 않습니다.

---

## Backend

Node.js / Express 기반 서버입니다.

### 주요 역할

- KIS API 인증
- Access Token 관리
- Approval Key 관리
- KIS WebSocket 연결
- 종목 구독 / 구독 해제
- 연결 상태 관리
- WebSocket 재연결
- 체결 메시지 파싱
- 실시간 데이터 정규화
- Frontend WebSocket으로 데이터 전달
- 비밀정보 및 환경변수 관리

---

## 한국투자증권 KIS Open API

Stock-Hear의 실시간 시장 데이터 소스입니다.

```text
REST API
→ 인증 및 관련 요청

WebSocket
→ 국내주식 실시간 체결정보
```

프론트엔드가 KIS에 직접 접근하지 않고 반드시 백엔드를 거치도록 구성했습니다.

```text
Frontend
↓
Backend
↓
KIS Open API
```

이를 통해 `KIS_APP_KEY`, `KIS_APP_SECRET`, Access Token, Approval Key 등의 인증정보가 프론트엔드에 노출되지 않도록 합니다.

---

## AI Layer

사용자의 자연어 입력과 기존 소리화 엔진 사이에서 실행 계획을 생성합니다.

### 주요 역할

- 사용자 자연어 질의 해석
- 사용자 의도 파악
- 필요한 슬롯 추출
- 멀티턴 맥락 유지
- 모호한 명령 확인
- `SonificationPlan` 생성
- 실시간 / Replay 데이터 선택
- 소리화와 TTS 요청 분기
- 기존 소리화 엔진에 실행 조건 전달

---

## Sonification Engine

시장 이벤트를 실제 소리로 변환합니다.

### 주요 역할

- 가격 변화 → 음높이
- 거래량 → 음량
- 체결빈도 → 리듬
- 실시간 데이터 소리화
- Replay 데이터 소리화
- 고정 소리화 규칙 유지
- Web Audio API 기반 소리 출력

---

## 기술 스택

### Frontend

- React
- Vite
- TypeScript
- WebSocket
- Web Audio API
- Web Speech API

### Backend

- Node.js
- Express
- TypeScript
- WebSocket

### External API

- 한국투자증권 KIS Open API
- KIS REST API
- KIS 실시간 WebSocket

### AI

- Natural Language Processing
- AI Sonification Planner
- Structured `SonificationPlan`
- Multi-turn Context
- Slot Filling
- Intent Classification

---

# 5. Development & Team

## 프로젝트 구조

```text
stock-hear/
apps/
web/
src/
components/
audio/
api/
types.ts
App.tsx
main.tsx
styles.css

server/
src/
kis/
config.ts
server.ts

docs/
package.json
```

### `apps/web`

사용자가 직접 사용하는 React 애플리케이션입니다.

주요 역할:

- 시장정보 표시
- Backend WebSocket 연결
- 소리화
- 음성 명령 및 TTS
- 접근성 기능

### `apps/server`

한국투자증권 Open API와 통신하는 Backend Server입니다.

주요 역할:

- KIS 인증
- KIS WebSocket 연결
- 실시간 데이터 수신
- 체결 메시지 파싱
- 데이터 정규화
- Frontend WebSocket 통신

### `docs`

프로젝트 개발 및 운영 문서를 관리합니다.

---

## 실행

### 전체 실행
=======
# stock-hear

시각장애인을 위한 **실시간 주식정보 소리화(Sonification) 서비스**입니다.

한국투자증권(KIS) Open API의 국내주식 실시간 체결정보를 백엔드에서 수신하고, 프론트엔드는 현재가·등락률·거래량을 **화면 텍스트 + 사운드 + 음성 안내(TTS/STT)** 세 가지 채널로 동시에 전달합니다. 시각 정보에 의존하지 않고도 시장의 움직임을 "듣고" 이해할 수 있게 하는 것이 목표입니다.

> 2025 Bitamin 여름 프로젝트

## 서비스 소개

| 기능 | 설명 |
|---|---|
| 실시간 체결 소리화 | 가격 변화 → 음높이, 거래량 → 음량으로 변환해 체결마다 소리로 재생 |
| 실시간 체결 텍스트 표시 | 현재가, 등락률, 체결량, 누적거래량, 마지막 체결시각을 화면에 표시 |
| 음성 명령 (STT) | "삼성전자 들려줘", "천천히 들려줘", "방금 무슨 소리였어" 같은 자연어 명령 인식 |
| 음성 안내 (TTS) | 현재가·등락률·거래량을 말로 안내, 소리 이벤트를 말로 설명 |
| 청취 모드 설정 | 가격 중심 / 가격+거래량 / 큰 변화만 알림 중 선택, 속도·볼륨·거래량 포함 여부 조절 |
| 접근성 | 키보드 내비게이션, 화면낭독기용 라벨(`aria-live` 등), WCAG AA 대비 기준 색상 |

구현하지 않는 기능: 매수, 매도, 계좌조회, 투자추천 (정보 전달 전용 MVP)

## 시스템 아키텍처

```text
┌────────────────────┐        WebSocket (실시간)        ┌──────────────────────┐        WebSocket        ┌────────────────────┐
│   한국투자증권(KIS)   │ ───────────────────────────────▶ │   Backend (Express)   │ ───────────────────────▶ │   Frontend (React)   │
│   Open API 서버      │                                  │   apps/server          │       /ws               │   apps/web            │
│                      │ ◀─────────────────────────────── │                        │ ◀─────────────────────  │                       │
└────────────────────┘   REST: approval key / access token └──────────────────────┘   subscribe / unsubscribe └────────────────────┘
                                                                     │                                                  │
                                                                     │ approval_key, appkey/secret                     ├─ Web Audio API   → 소리화 (음높이/음량)
                                                                     │  (.env, 서버 전용 보관)                          ├─ Web Speech API  → STT(명령 인식) / TTS(음성 안내)
                                                                     ▼                                                  └─ localStorage    → 선택 종목·소리 설정 유지
                                                             종목별 구독 카운팅
                                                          (여러 프론트가 같은 종목을
                                                           볼 때 KIS 구독은 1회만 유지)
```

**데이터 흐름**

1. 서버가 기동 시 KIS REST API로 `access token` / `approval key` 발급 (`apps/server/src/kis/auth.ts`)
2. 서버가 KIS 실시간 WebSocket(`H0STCNT0`, 국내주식 체결가)에 연결 (`apps/server/src/kis/websocket.ts`)
3. 프론트가 `/ws`로 접속해 `{ type: "subscribe", symbol }` 전송 → 서버가 해당 종목을 KIS에 구독 요청
4. KIS가 체결 데이터를 보내면 서버가 파싱(`parser.ts`)해 `RealtimeTrade`로 변환
5. 서버는 그 종목을 구독 중인 프론트에만 `{ type: "trade", trade }`로 전달 (전체 브로드캐스트 아님)
6. 프론트는 수신한 trade를 화면에 표시하는 동시에 `Sonification` 엔진으로 소리를 재생하고, 필요 시 TTS로 안내

**보안 원칙**: `KIS_APP_KEY`, `KIS_APP_SECRET`, access token, approval key는 서버(`apps/server/.env`)에만 존재하며 프론트엔드로 절대 전달되지 않습니다. 프론트는 우리 백엔드하고만 통신하고 KIS와 직접 연결하지 않습니다.

## 폴더 구조

```text
stock-hear/
  apps/
    web/                      # React + Vite 프론트엔드
      src/
        components/           # StockSelector, MarketDisplay, AudioControls, VoiceControls
        audio/                # sonification.ts(소리화), speech.ts(STT/TTS), voiceIntent.ts(자연어 의도 해석)
        api/                  # marketSocket.ts(백엔드 WebSocket 클라이언트)
        types.ts
        App.tsx
        main.tsx
        styles.css
    server/                   # Express + ws 백엔드
      src/
        kis/                  # auth.ts, websocket.ts, parser.ts
        config.ts
        server.ts
  docs/                       # 팀 운영 문서
  package.json
```

## 기술 스택

- **Frontend**: React, TypeScript, Vite, Web Audio API, Web Speech API
- **Backend**: Node.js, Express, `ws`(WebSocket), Zod(환경변수 검증), dotenv
- **외부 연동**: 한국투자증권(KIS) Open API — REST(인증) + WebSocket(실시간 체결)
- **모노레포**: npm workspaces

## 실행 방법
>>>>>>> upstream/dev

```bash
npm install
npm run dev
```

<<<<<<< HEAD
### 개별 실행

Backend:

```bash
npm run dev:server
```

Frontend:

```bash
npm run dev:web
```

### 기본 주소

```text
Frontend
http://localhost:5173

Backend Health
http://localhost:4000/api/health

Backend WebSocket
ws://localhost:4000/ws
```

---

## 검증
=======
개별 실행:

```bash
npm run dev:server
npm run dev:web
```

기본 주소:

| 대상 | 주소 |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend health check | `http://localhost:4000/api/health` |
| Backend WebSocket | `ws://localhost:4000/ws` |

검증:
>>>>>>> upstream/dev

```bash
npm run typecheck
npm run build
```

<<<<<<< HEAD
---

## 환경변수 및 보안

실제 한국투자증권 인증정보는 Backend의 `.env` 파일에서 관리합니다.

```text
apps/server/.env
```

다음 정보는 Frontend로 전달하지 않습니다.

- `KIS_APP_KEY`
- `KIS_APP_SECRET`
- Access Token
- Approval Key

Frontend의 `VITE_` 환경변수에는 공개 가능한 Backend 주소만 저장합니다.

---

---

## 역할별 시스템 연결

```text
KIS API Integration
↓
실시간 데이터 수신
↓
Backend / WebSocket
↓
AI / Voice Interface
↓
Sonification Planner
↓
Sonification Engine
↓
사용자 음성·음향 출력
```

각 기능을 독립적으로 구현하는 것이 아니라 실시간 데이터 수신부터 사용자 입력 해석, 소리화까지 하나의 데이터 흐름으로 연결되도록 구성했습니다.

---

---

## Summary

Stock-Hear는 단순히 주식 숫자를 음성으로 읽어주는 서비스를 넘어, **실시간 시장의 움직임 자체를 사용자가 들을 수 있도록 만드는 서비스**입니다.

```text
한국투자증권 실시간 데이터
↓
Backend
↓
AI Sonification Planner
↓
실행 조건 구조화
↓
기존 Sonification Engine
↓
소리 / 음성
↓
User
```

AI는 사용자의 자연스러운 요청을 이해하고 기존 시스템이 실행 가능한 형태로 변환하며, 실제 소리 생성은 고정된 Sonification Engine이 담당합니다.

이를 통해 기존의 시각 중심 주식정보를 **화면 + 음성 + 소리**의 멀티모달 정보로 확장했습니다.
=======
## 환경변수

실제 한국투자증권 인증정보는 `apps/server/.env`에만 저장합니다 (Git에 커밋되지 않음).

```env
# apps/server/.env
KIS_APP_KEY=
KIS_APP_SECRET=
KIS_REST_BASE_URL=
KIS_WEBSOCKET_URL=
KIS_ENVIRONMENT=real   # real | virtual
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

```env
# apps/web/.env (선택, 공개 가능한 값만)
VITE_API_BASE_URL=http://localhost:4000
VITE_WEBSOCKET_URL=ws://localhost:4000/ws
```

## 브랜치 & 팀원 역할

| 브랜치 | 담당자 | 작업 내용 |
|---|---|---|
| `feature/kis-auth` | 웅주 (나웅주) | 한국투자증권 인증 — access token, approval key 발급 (`kis/auth.ts`) |
| `feature/backend-websocket` | 수민 (김수민) | 백엔드 WebSocket — KIS 실시간 연결, 재연결, 프론트 중계 서버 (`server.ts`, `kis/websocket.ts`) |
| `feature/realtime-integration` | 수민 | KIS 실시간 데이터 연동 및 파싱 구현 |
| `feature/frontend-backend-integration` | 수민 | 프론트엔드 종목 선택 ↔ 백엔드 실시간 연동 |
| `feature/web-audio` | 수아 (오수아) | 소리화(Sonification) 엔진 — 가격→음높이, 거래량→음량 매핑, 임계치 조정 (`audio/sonification.ts`) |
| `feature/voice-command`, `feature/voice-guidance-fields` | 아형 (이아형) | 음성 명령(STT) 처리, 음성 안내(TTS), 자연어 의도 해석, 상태 표시·오류 처리 (`audio/speech.ts`, `VoiceControls.tsx`) |
| `dev` | 전체 | 기능 브랜치 통합, UI 리디자인, 접근성/문구 정비 |
| `main` | 전체 | 배포 기준 브랜치 |

> 담당자 매핑은 커밋 이력과 [docs/TASKS.md](docs/TASKS.md) 작업 배정표를 기준으로 정리했습니다. 최신 담당/상태는 TASKS.md를 우선합니다.

## 프로젝트 문서

- [파일 및 폴더 역할](docs/FILE_STRUCTURE.md)
- [디자인 시스템](docs/DESIGN.md)
- [개발 규칙](docs/DEVELOPMENT_RULES.md)
- [전체 체크리스트](docs/TEAM_CHECKLIST.md)
- [보안 규칙](docs/SECURITY_RULES.md)
- [한국투자증권 API 연동 기록](docs/API_INTEGRATION.md)
- [작업 배정표](docs/TASKS.md)
>>>>>>> upstream/dev
