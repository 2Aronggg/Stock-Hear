# 팀 프로젝트 체크리스트

## 초기 설정

- [x] npm workspaces 구성
- [x] React, TypeScript, Vite 프론트엔드 구성
- [x] Express, ws, TypeScript 백엔드 구성
- [x] MVP용 최소 파일 구조 정리
- [x] `.env` Git 제외
- [x] `.env.example` Git 포함
- [ ] 팀 GitHub 저장소 생성
- [ ] `main`, `develop` 브랜치 운영 방식 확정

## 백엔드

- [x] `GET /api/health` 응답
- [x] `/ws` WebSocket 서버
- [x] subscribe 메시지 처리
- [x] unsubscribe 메시지 처리
- [x] ping/pong 처리
- [ ] 한국투자증권 access token 발급
- [ ] 한국투자증권 approval key 발급
- [ ] 한국투자증권 실시간 WebSocket 연결
- [ ] 종목 구독과 구독 해제 연결
- [ ] 원본 메시지 파싱
- [ ] `RealtimeTrade` 변환

## 프론트엔드

- [x] 서버 연결 상태 표시
- [x] 종목 선택
- [x] 소리 시작/중지
- [x] 음소거
- [x] 볼륨 조절
- [x] 음성 명령 버튼
- [ ] 실제 현재가 표시
- [ ] 실제 등락률 표시
- [ ] 실제 거래량 표시
- [ ] 체결빈도 리듬 반영
- [ ] 재연결 상태 안내 개선

## 접근성

- [x] Skip Link 제공
- [x] 포커스 스타일 유지
- [x] 버튼 이름 제공
- [x] 화면낭독기용 live region 제공
- [ ] Tab 키만으로 전체 동작 확인
- [ ] 화면낭독기 테스트
- [ ] TTS와 화면낭독기 충돌 확인

## 보안

- [x] 실제 인증정보는 `apps/server/.env`에만 저장
- [x] 프론트엔드 환경변수에 비밀값 없음
- [x] `.env.example`에는 실제 값 없음
- [x] 매수, 매도, 계좌조회 기능 없음
- [ ] Git 이력에 비밀값이 없는지 확인
- [ ] 발표 화면과 스크린샷에 `.env`가 보이지 않는지 확인

## 검증

- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] 백엔드와 프론트엔드 동시 실행 확인
- [ ] 브라우저에서 기본 화면 확인

