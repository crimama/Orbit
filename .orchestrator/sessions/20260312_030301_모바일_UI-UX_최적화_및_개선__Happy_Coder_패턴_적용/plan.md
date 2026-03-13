# Development Plan

## Query
모바일 UI/UX 최적화 및 개선 — Happy Coder 패턴 적용

## Created
2026-03-12T03:03:01.729208

## Plan

### 목표
모바일에서 Agent Orbit을 데스크탑과 동등하게 사용 가능하도록 UI/UX 개선.
Happy Coder 검증 패턴 + 터미널 에코시스템 리서치 기반.

### Agent 할당 (5개, 병렬)

| Agent | 작업 | 파일 |
|-------|------|------|
| agent-01 | 모바일 Dashboard & 세션 카드 | Dashboard.tsx, SessionList.tsx |
| agent-02 | VirtualKeyboard v2 | VirtualKeyboard.tsx |
| agent-03 | MobileLayout + PWA + Viewport | MobileLayout.tsx, layout.tsx, useMobile.ts |
| agent-04 | Mobile Terminal UX | TerminalPane.tsx |
| agent-05 | Socket 이벤트 최적화 | terminal handler, sessionManager |

### 파일 충돌: 없음 (모든 에이전트 병렬 실행 가능)

### 검증 기준
- `npx tsc --noEmit` 통과
- `npm run build` 성공
