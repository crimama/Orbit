# Plan: 터미널 에코시스템 핵심 발견 구현

## 목표

리서치 노트(2026-03-12)의 단기 실익 항목 3가지 구현:

1. **터미널 썸네일 프리뷰** — 대시보드 세션 카드에 터미널 내용 미리보기
2. **실시간 세션 업데이트** — session-update 소켓 이벤트로 대시보드 자동 갱신
3. **에이전트 알림** — 세션 종료/에러 시 브라우저 Notification

## 작업 분해

### agent-01: 백엔드 — 터미널 프리뷰 캡처 + session-update emit
- **파일**: `src/server/socket/handlers/terminal.ts`, `src/server/pty/ptyManager.ts`, `src/server/ssh/remotePty.ts`
- 각 backend에 `getScreenPreview(id): string` 메서드 추가 (scrollback 마지막 N줄)
- session-exit, session-create 시 `io.emit("session-update", sessionInfo)` 브로드캐스트
- `session-list` 응답에 `lastContext` 필드를 터미널 프리뷰로 채움

### agent-02: 프론트엔드 — 대시보드 실시간 갱신 + 세션 프리뷰 표시 + 브라우저 알림
- **파일**: `src/components/dashboard/Dashboard.tsx`, `src/components/dashboard/SessionList.tsx`
- Dashboard에 `session-update` 소켓 리스너 추가 → sessions 상태 자동 갱신
- SessionList에 `lastContext` 프리뷰 표시 개선 (모노스페이스, 2줄 제한)
- 세션 종료 시 `Notification` API로 브라우저 알림 (권한 요청 포함)

## 의존성

agent-01 (backend) → agent-02 (frontend)는 독립 실행 가능.
agent-01이 emit하는 이벤트를 agent-02가 listen하지만, 타입은 이미 정의됨.
