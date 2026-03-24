# Task: Audit Logger Backend + API

## Agent
agent-01

## Status
pending

## Description
감사 로그 시스템을 구현한다.

## 1. src/server/audit/auditLogger.ts (신규)
간단한 싱글톤 클래스. Prisma를 통해 AuditLog 테이블에 이벤트를 기록한다.

```typescript
import { prisma } from '@/lib/prisma';
import type { AuditEventType } from '@/lib/types';

class AuditLogger {
  async log(params: {
    eventType: AuditEventType;
    action: string;
    sessionId?: string;
    projectId?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        eventType: params.eventType,
        action: params.action,
        sessionId: params.sessionId ?? null,
        projectId: params.projectId ?? null,
        detail: params.detail ? JSON.stringify(params.detail) : null,
      },
    });
  }
}
export const auditLogger = new AuditLogger();
```

## 2. src/app/api/audit/route.ts (신규)
GET 엔드포인트. 쿼리 파라미터: sessionId, projectId, eventType, limit (기본 50), offset.
기존 API 패턴 참고: src/app/api/projects/route.ts

```typescript
// 반환: { data: AuditLogInfo[] }
const logs = await prisma.auditLog.findMany({
  where: { ... },
  orderBy: { createdAt: 'desc' },
  take: limit, skip: offset,
});
```

## 3. src/server/pty/interceptor.ts 수정
- resolve() 메서드 (approve/deny 시) 에서 auditLogger.log() 호출
- 기존 import에 auditLogger 추가
- approve 시: eventType='interceptor_approve', action='Approved: {command}'
- deny 시: eventType='interceptor_deny', action='Denied: {command}'

## 4. src/server/session/sessionManager.ts 수정
- createSession() 에서: eventType='session_create', action='Created session {id}'
- terminateSession() 에서: eventType='session_terminate', action='Terminated session {id}'

## 참고
- prisma import: import { prisma } from '@/lib/prisma'
- AuditEventType 타입은 src/lib/types.ts에 이미 정의됨
- AuditLogInfo 타입도 이미 정의됨
- NextResponse 패턴: import { NextResponse } from 'next/server'

## Target Files
- `src/server/audit/auditLogger.ts`
- `src/app/api/audit/route.ts`
- `src/server/pty/interceptor.ts`
- `src/server/session/sessionManager.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] auditLogger.log()가 정상 작동
- [ ] GET /api/audit가 AuditLogInfo[] 반환
- [ ] interceptor approve/deny 시 로그 기록
- [ ] session create/terminate 시 로그 기록
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
