# DESIGN.md

stock-hear 웹 프론트(`apps/web`)의 디자인 시스템 기준 문서. 실제 값은 [`apps/web/src/styles.css`](../apps/web/src/styles.css)의 `:root` 토큰과 일치한다.

## 1. Colors

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-base` | `#f5f5f4` | 페이지 배경 |
| `--color-surface` | `#ffffff` | 카드/패널 배경 |
| `--color-ink` | `#111111` | 본문/헤드라인 텍스트, 강조 배경 |
| `--color-muted` | `#6b7280` | 보조 텍스트(설명, 라벨) |
| `--color-line` | `rgba(17, 17, 17, 0.48)` | 카드/입력 요소 테두리 (WCAG AA 3:1 기준 충족) |
| `--color-purple` | `#6b21a8` | 주요 액션(버튼) |
| `--color-purple-soft` / `--color-peach` | `#d9c7ff` / `#ffd9c7` | 배경 그라데이션 포인트 |
| `--color-up` | `#e5484d` | 상승(빨강 계열) |
| `--color-down` | `#2563eb` | 하락(파랑 계열) |
| `--color-live` | `#22c55e` | 실시간 연결됨 상태 |

접근성 참고: `--color-line`은 저대비(0.08 alpha) 상태였다가 WCAG AA 비텍스트 대비(1.4.11, 3:1) 기준을 맞추기 위해 0.48로 조정됨 — 색상(hue)은 그대로, 명도만 변경.

## 2. Typography

- 서체: **Pretendard Variable** (본문/헤드라인 공통 사용, CDN으로 로드 — [`apps/web/index.html`](../apps/web/index.html) 참고)
- 폰트 스택: `"Pretendard Variable", Pretendard, "Noto Sans KR", "Wanted Sans Variable", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- 본문: 16px, line-height 1.6, `font-variant-numeric: tabular-nums`(숫자 자릿수 정렬)
- 헤드라인(hero h1): 64px, weight 900, line-height 1.04
- 섹션 타이틀(market-feature h2): ~38px, weight 900
- 패널 타이틀(panel h2): ~18px, weight 850
- 강조 숫자(price-card): ~61px, weight 900, tabular-nums
- 라벨/키커(panel-kicker, eyebrow): ~12.5px, weight 800, uppercase
- 버튼 텍스트: weight 700

모든 font-family는 `:root`(styles.css 최상단) 한 곳에서만 지정하며, 컴포넌트별 개별 font-family 지정은 없음 — 새 컴포넌트를 추가할 때도 이 규칙을 유지할 것.
