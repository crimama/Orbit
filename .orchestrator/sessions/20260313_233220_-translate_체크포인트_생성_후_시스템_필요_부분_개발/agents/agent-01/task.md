# Task: Socket Lifecycle + Page Visibility

## Agent
agent-01

## Status
pending

## Description
usePageVisibility 훅 생성 (src/lib/hooks/usePageVisibility.ts) + useSocket.ts에 통합. 30초 이상 백그라운드 시 socket.disconnect(), 복귀 시 socket.connect(). 기존 useSocket 인터페이스 유지하면서 backgrounded 상태 추가.

## Target Files
- `src/lib/hooks/usePageVisibility.ts`
- `src/lib/useSocket.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] 30초+ 탭전환 시 소켓 끊김
- [ ] 복귀 시 2초 내 재연결
- [ ] 짧은 전환은 유지
- [ ] TypeScript strict 통과

## Notes
(Orchestrator may add coordination notes here)
