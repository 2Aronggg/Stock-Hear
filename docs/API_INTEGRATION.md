# 한국투자증권 API 연동 기록

실제 키 값은 이 문서에 작성하지 않는다.

## 사용 환경

- [ ] 실전투자
- [ ] 모의투자

## 서버 환경변수

```env
KIS_APP_KEY=
KIS_APP_SECRET=
KIS_REST_BASE_URL=
KIS_WEBSOCKET_URL=
KIS_ENVIRONMENT=real
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

## 프론트엔드 환경변수

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_WEBSOCKET_URL=ws://localhost:4000/ws
```

프론트엔드 환경변수에는 비밀정보를 넣지 않는다.

## 인증 흐름

```text
apps/server/.env에 인증정보 저장
서버에서 access token 요청
서버에서 approval key 요청
서버에서 한국투자증권 실시간 WebSocket 연결
서버에서 종목 구독 요청
체결정보 수신
MarketTrade로 변환
프론트엔드 /ws로 전달
```

## MarketTrade 구조

프론트엔드와 서버는 같은 필드 구조를 유지한다.

| 필드 | 설명 |
|---|---|
| `market` | 시장 구분 (`KR` 또는 `US`) |
| `exchange` | 거래소 코드 |
| `symbol` | 종목코드 |
| `stockName` | 종목명 |
| `currency` | 통화 (`KRW` 또는 `USD`) |
| `tradeTime` | 체결시각 |
| `currentPrice` | 현재가 |
| `changePrice` | 전일 대비 가격 |
| `changeRate` | 전일 대비 등락률 |
| `tradeVolume` | 체결량 |
| `accumulatedVolume` | 누적거래량 |
| `receivedAt` | 서버 수신 시각 |

## 필드 매핑 기록

공식 문서 확인 전에는 원본 필드명을 확정하지 않는다.

| 우리 필드 | 한국투자증권 원본 필드 | 확인 여부 |
|---|---|---|
| `symbol` | `MKSC_SHRN_ISCD` | [x] |
| `stockName` | 서버 지원 종목 매핑 | [x] |
| `tradeTime` | `STCK_CNTG_HOUR` | [x] |
| `currentPrice` | `STCK_PRPR` | [x] |
| `changePrice` | `PRDY_VRSS` | [x] |
| `changeRate` | `PRDY_CTRT` | [x] |
| `tradeVolume` | `CNTG_VOL` | [x] |
| `accumulatedVolume` | `ACML_VOL` | [x] |

## 미국주식 실시간 체결 매핑

- TR ID: `HDFSCNT0`
- 구독 키 예시: 나스닥 Apple `DNASAAPL`
- 미국 무료 시세는 KIS 안내상 0분 지연 체결가로 제공된다.

| 우리 필드 | 한국투자증권 원본 필드 |
|---|---|
| `symbol` | `SYMB` |
| `tradeTime` | `KHMS` (없으면 `XHMS`) |
| `currentPrice` | `LAST` |
| `changePrice` | `DIFF` |
| `changeRate` | `RATE` |
| `tradeVolume` | `EVOL` |
| `accumulatedVolume` | `TVOL` |

## 테스트 기록

| 날짜 | 담당자 | 환경 | 종목 | 연결 성공 | 데이터 수신 | 오류 |
|---|---|---|---|---|---|---|
| 미정 | 미정 | 미정 | 미정 | [ ] | [ ] | 미정 |

## Replay 샘플 채집

Replay 샘플 저장 API는 기본적으로 비활성화한다. 로컬에서 샘플을
채집할 때만 `apps/server/.env`에 다음 값을 설정하고 서버를 재시작한다.

```env
REPLAY_SAMPLE_WRITE_ENABLED=true
```

원하는 종목을 프론트엔드에서 선택하고 충분한 체결을 수신한 다음,
별도 PowerShell 창에서 저장 API를 한 번 호출한다.

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4000/api/replay/samples/005930
```

샘플은 `apps/server/data/replay/<종목코드>.json`에 저장된다. 기존
파일은 자동으로 덮어쓰지 않으며 같은 종목을 다시 저장하면 HTTP
`409`를 반환한다. 국내장과 미국장 샘플을 각각 확정한 뒤에는 환경변수를
다시 `false`로 변경한다.

서버는 시작할 때 이 디렉터리의 모든 JSON 샘플을 읽고 형식을 검증한다.
샘플이 없으면 빈 목록으로 정상 시작하며, 잘못된 JSON이나 필드가 있으면
서버 로그와 `/api/health`의 `replay.status`에서 오류를 확인할 수 있다.

## Replay WebSocket 요청

클라이언트는 저장된 샘플의 최근 1분·3분·5분을 요청할 수 있다.

```json
{
  "type": "replay",
  "symbol": "005930",
  "windowSeconds": 300
}
```

`windowSeconds`는 `60`, `180`, `300` 중 하나만 허용한다. 서버는
요청한 구간만큼 메모리 버퍼가 충분하면 `dataMode: "replay"`로 최근 실제
체결을 사용한다. 버퍼가 부족하면 저장된 샘플을 `dataMode: "demo"`로
사용한다. `replay_started` 뒤에 체결 데이터를 순서대로 전송하고 마지막에
`replay_completed`를 보낸다. 많은 체결은 가격 흐름을 유지하며 최대
300건으로 균등 추출한다.

