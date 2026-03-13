# Task: 백엔드: 터미널 프리뷰 캡처 + session-update 브로드캐스트

## Agent
agent-01

## Status
pending

## Description
3가지 구현:

1. PtyBackend 인터페이스에 getScreenPreview(id: string, lines?: number): string 메서드 추가 (src/server/pty/ptyBackend.ts)
   - scrollback 버퍼에서 마지막 N줄(기본 5줄)을 추출하여 반환
   - ANSI escape 시퀀스 strip하여 플레인텍스트만 반환

2. PtyManager(src/server/pty/ptyManager.ts)와 RemotePty(src/server/ssh/remotePty.ts)에 getScreenPreview 구현
   - outputBuffers에서 마지막 5줄 추출
   - ANSI strip: 정규식 /\x1b\[[0-9;]*[A-Za-z]/g 제거

3. terminal.ts 소켓 핸들러(src/server/socket/handlers/terminal.ts) 수정:
   - session-list 핸들러에서 각 세션의 lastContext를 backend.getScreenPreview()로 채움
   - session-exit 시 io.to('dashboard').emit('session-update', sessionInfo) 브로드캐스트
   - 새 소켓 이벤트 'dashboard-join' 추가: 클라이언트가 dashboard 룸에 조인

참고: ServerToClientEvents에 session-update는 이미 (session: SessionInfo) => void로 정의되어 있음.
SessionInfo.lastContext 필드도 이미 존재 (string | null).
AGENTS.md 참조하여 프로젝트 컨벤션 준수.

## Target Files
- `src/server/pty/ptyBackend.ts`
- `src/server/pty/ptyManager.ts`
- `src/server/ssh/remotePty.ts`
- `src/server/socket/handlers/terminal.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] getScreenPreview가 ANSI-stripped 플레인텍스트 반환
- [ ] session-list에 lastContext 포함
- [ ] session-exit시 session-update emit
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
