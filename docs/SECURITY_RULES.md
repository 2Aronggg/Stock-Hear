# 보안 규칙

## 비밀정보

다음 값은 코드, 문서, 로그, 프론트엔드에 노출하지 않는다.

- `KIS_APP_KEY`
- `KIS_APP_SECRET`
- access token
- approval key
- 계좌번호

현재 MVP는 계좌번호를 사용하지 않으며 매수, 매도, 계좌조회, 투자추천 기능을 제공하지 않는다.

## 저장 위치

실제 한국투자증권 인증정보는 다음 파일에만 저장한다.

```text
apps/server/.env
```

이 파일은 Git에 포함하지 않는다.

## Git 제외 대상

`.gitignore`에는 최소 다음 항목이 포함되어야 한다.

```gitignore
.env
.env.local
.env.*.local
apps/server/.env
apps/server/.env.local
apps/web/.env
apps/web/.env.local
```

`apps/server/.env.example`과 `apps/web/.env.example`은 Git에 포함한다. 단 실제 값은 넣지 않는다.

## 프론트엔드 금지 사항

- `VITE_KIS_APP_KEY` 같은 변수를 만들지 않는다.
- `VITE_KIS_APP_SECRET` 같은 변수를 만들지 않는다.
- access token과 approval key를 브라우저로 보내지 않는다.
- 한국투자증권 원본 인증 응답을 화면에 표시하지 않는다.

## 로그 규칙

- API 키, secret, token, approval key를 `console.log`, `console.info`, `console.error`로 출력하지 않는다.
- 오류 메시지에는 값이 아니라 필드명과 상태만 적는다.
- 원본 API 응답 전체를 그대로 저장하지 않는다.

## 유출 시 대응

1. 즉시 팀에 알린다.
2. 노출된 키를 폐기하거나 재발급한다.
3. Git 이력, PR, Issue, 로그, 스크린샷을 확인한다.
4. 배포 환경변수를 교체한다.
5. 유출 원인과 재발 방지책을 기록한다.

