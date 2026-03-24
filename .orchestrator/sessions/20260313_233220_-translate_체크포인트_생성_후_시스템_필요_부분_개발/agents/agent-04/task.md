# Task: WebGL Context Loss + Touch + Terminal Skeleton

## Agent
agent-04

## Status
pending

## Description
@xterm/addon-webgl 동적 로드(try/catch). webglcontextlost 이벤트 시 Canvas 폴백(크래시 없음). 터치 탭으로 커서 이동(스크롤과 구분: 10px 임계값). 기존 스피너를 4-5개 펄싱 바 터미널 스켈레톤으로 교체. 콘솔에 WebGL 상태 로그.

## Target Files
- `src/components/terminal/TerminalView.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] WebGL 활성 시 콘솔 로그
- [ ] 컨텍스트 손실 시 graceful 폴백
- [ ] 터치 탭 동작
- [ ] 스켈레톤 표시
- [ ] TypeScript strict 통과

## Notes
(Orchestrator may add coordination notes here)
