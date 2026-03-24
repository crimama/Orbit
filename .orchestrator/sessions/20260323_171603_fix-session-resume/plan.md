# Plan: Fix Session Resume After Server Restart

## 문제
서버 재시작 후 세션이 이어지지 않고 Claude Code 초기 화면만 표시됨.

## 근본 원인 3가지
1. `sessionRef`가 Orbit UUID로 저장됨 (Claude 세션 ID가 아님)
2. 모든 resume에 `--fork-session` 사용 (분기 생성, 이어가기 아님)
3. Claude가 생성한 실제 세션 ID를 캡처하지 않음

## 수정 범위

### agent-01: sessionManager 전체 수정
- **파일**: `src/server/session/sessionManager.ts`
- **변경**:
  1. `--fork-session` 제거 (4곳: dockerInnerCommand, getPtyOptionsForCreate, getPtyOptionsForRecover, getRemoteHostBootstrapCommand)
  2. `--resume`만 사용하도록 변경
  3. 새 세션 생성 후 `~/.claude/projects/<key>/` 스캔하여 실제 Claude session ID 캡처
  4. `captureClaudeSessionRef()` 메서드 추가 — 타이머 기반으로 JSONL 파일 감지
  5. `getPtyOptionsForRecover()` 수정 — 유효한 sessionRef 있으면 항상 `--resume` 사용

## 에이전트 배정
| Agent | 작업 | 파일 | deps |
|-------|------|------|------|
| agent-01 | session resume 전체 수정 | sessionManager.ts | 없음 |
