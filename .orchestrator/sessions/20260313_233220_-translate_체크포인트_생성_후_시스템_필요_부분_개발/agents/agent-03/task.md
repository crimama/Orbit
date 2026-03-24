# Task: Optimistic UI + Skeleton Screens

## Agent
agent-03

## Status
pending

## Description
SessionComposerDock: 전송 즉시 입력 클리어(블로킹 제거), 실패 시 에러 표시+텍스트 복원. SessionChatbotView: 로딩 시 3개 펄싱 스켈레톤 바(animate-pulse, bg-neutral-800). MobileChatTerminal: 동일 스켈레톤 패턴 적용. 기존 loaded 상태 활용.

## Target Files
- `src/components/terminal/SessionComposerDock.tsx`
- `src/components/terminal/SessionChatbotView.tsx`
- `src/components/terminal/MobileChatTerminal.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] 프롬프트 전송 시 textarea 즉시 클리어
- [ ] 실패 시 재시도 가능
- [ ] 로딩 중 스켈레톤 표시
- [ ] animate-pulse 사용
- [ ] TypeScript strict 통과

## Notes
(Orchestrator may add coordination notes here)
