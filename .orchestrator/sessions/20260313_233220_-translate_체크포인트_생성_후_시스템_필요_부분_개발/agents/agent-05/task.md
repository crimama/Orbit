# Task: OLED Dark Mode 인프라

## Agent
agent-05

## Status
pending

## Description
useTheme 훅 생성(src/lib/hooks/useTheme.ts): localStorage orbit-theme 읽기, default|oled, data-theme 속성 설정, SSR safety. globals.css: [data-theme=oled] 블록에 --background:#000000, --terminal-bg:#000000 추가. 기본 :root에 --terminal-bg:#0b1220 추가. tailwind.config.ts: terminalBg: var(--terminal-bg) 컬러 추가.

## Target Files
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/lib/hooks/useTheme.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] orbit-theme=oled 시 순수 블랙
- [ ] 기본 테마 변경 없음
- [ ] CSS변수 --terminal-bg 사용 가능
- [ ] SSR 에러 없음
- [ ] TypeScript strict 통과

## Notes
(Orchestrator may add coordination notes here)
