# Task: Socket 이벤트 최적화 — Ephemeral 분리 + Presence 디바운싱

## Agent
agent-05

## Status
pending

## Description
모바일 대역폭 절약을 위해 Socket.io 이벤트를 최적화한다.
Happy Coder의 persistent/ephemeral 이벤트 분리 패턴 적용.

## 현재 상태
- terminal handler: 모든 terminal-data를 즉시 전송
- DeltaBatcher: 이미 배치 전송 구현됨 (deltaStream.ts)
- sessionManager: 세션 상태 변경마다 즉시 DB 쓰기 + 브로드캐스트

## 구현 사항

### 1. Presence 디바운싱 (sessionManager.ts)
- updateSessionActivity() 호출을 5초 디바운싱
- 인메모리에 마지막 활동 시간 저장
- 5초 간격으로 배치 DB 업데이트
- DB 쓰기 90% 감소 예상

구현 방법:
```typescript
// sessionManager.ts에 추가
private activityBuffer = new Map<string, number>(); // sessionId → lastActivity timestamp
private activityFlushTimer: ReturnType<typeof setInterval> | null = null;

startActivityFlusher(): void {
  this.activityFlushTimer = setInterval(() => {
    this.flushActivityBuffer();
  }, 5000);
}

private async flushActivityBuffer(): Promise<void> {
  if (this.activityBuffer.size === 0) return;
  const entries = Array.from(this.activityBuffer.entries());
  this.activityBuffer.clear();
  // Batch update
  for (const [sessionId, timestamp] of entries) {
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date(timestamp) },
    }).catch(() => {});
  }
}

bufferActivity(sessionId: string): void {
  this.activityBuffer.set(sessionId, Date.now());
}
```

### 2. Terminal Handler 최적화 (terminal.ts)
- terminal-data 수신 시 sessionManager.bufferActivity(sid) 호출 (즉시 DB 쓰기 대신)
- session-attach/detach는 즉시 처리 (persistent 이벤트)

### 3. 세션 업데이트 브로드캐스트 쓰로틀링
- session-update 이벤트를 2초 쓰로틀링
- 같은 세션의 빠른 연속 업데이트를 하나로 병합
- 최종 상태만 브로드캐스트

## 참고 파일
- src/server/socket/handlers/terminal.ts (179줄)
- src/server/session/sessionManager.ts

## 컨벤션
- TypeScript strict mode
- camelCase 유틸리티 함수
- Prisma Client 타입 안전 쿼리

## Target Files
- `src/server/socket/handlers/terminal.ts`
- `src/server/session/sessionManager.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] activityBuffer가 sessionManager에 존재
- [ ] 5초 간격 배치 DB 업데이트
- [ ] terminal handler에서 bufferActivity 호출
- [ ] session-update 쓰로틀링 적용

## Notes
(Orchestrator may add coordination notes here)
