# Task: 100dvh 뷰포트 통일

## Agent
agent-02

## Status
pending

## Description
모든 페이지에서 h-screen → h-[100dvh], min-h-screen → min-h-[100dvh] 교체. iOS Safari 키보드 오픈 시 뷰포트 오버플로우 방지. 대상: TerminalPage.tsx, login/page.tsx, graph/page.tsx, compare/page.tsx, sessions/[id]/page.tsx

## Target Files
- `src/components/terminal/TerminalPage.tsx`
- `src/app/login/page.tsx`
- `src/app/graph/page.tsx`
- `src/app/compare/page.tsx`
- `src/app/sessions/[id]/page.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] h-screen 0건
- [ ] min-h-screen 0건
- [ ] 데스크탑 동작 유지
- [ ] TypeScript strict 통과

## Notes
(Orchestrator may add coordination notes here)
