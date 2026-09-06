# 작업 배정표

상태는 `대기`, `진행 중`, `리뷰 중`, `완료`, `보류` 중 하나만 사용한다.

| ID | 작업 | 담당자 | 브랜치 | 상태 | 관련 파일 | 비고 |
|---|---|---|---|---|---|---|
| T-01 | MVP 최소 구조 정리 | 미정 | `chore/simplify-mvp` | 완료 | 전체 | 파일 구조 단순화 |
| T-02 | 한국투자증권 인증 구현 | 웅주 | `feature/kis-auth` | 대기 | `apps/server/src/kis/auth.ts` | access token, approval key |
| T-03 | 한국투자증권 WebSocket 구현 | 수민 | `feature/backend-websocket` | 대기 | `apps/server/src/kis/websocket.ts` | 실시간 연결, 재연결 |
| T-04 | 체결 메시지 파싱 | 미정 | `feature/kis-parser` | 대기 | `apps/server/src/kis/parser.ts` | 공식 필드 확인 후 구현 |
| T-05 | 프론트 실데이터 표시 | 미정 | `feature/market-display` | 진행 중 | `apps/web/src/components/MarketDisplay.tsx` | 서버 trade 연결 필요 |
| T-06 | 소리화 고도화 | 수아 | `feature/web-audio` | 진행 중 | `apps/web/src/audio/sonification.ts` | 체결빈도 리듬 추가 |
| T-07 | 음성 명령 고도화 | 아형 | `feature/voice-command` | 진행 중 | `apps/web/src/audio/speech.ts`, `VoiceControls.tsx` | 브라우저 테스트 필요. 원격에 브랜치 아직 안 올라옴 |
| T-08 | 접근성 검증 | 미정 | `feature/accessibility-check` | 대기 | `App.tsx`, `styles.css` | 키보드, 화면낭독기 |

## 작업 규칙

- 작업 시작 전 담당자와 브랜치를 기록한다.
- 상태가 바뀌면 즉시 수정한다.
- 같은 파일을 여러 명이 수정할 때는 먼저 협의한다.
- 완료 전 `npm run typecheck`와 `npm run build`를 확인한다.
- 기능을 완료하면 관련 체크리스트와 문서를 함께 갱신한다.

