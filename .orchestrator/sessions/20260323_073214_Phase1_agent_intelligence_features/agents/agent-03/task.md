# Task: Session Checkpoint + Fork API

## Agent
agent-03

## Status
pending

## Description
세션 체크포인트 생성/조회와 포크 기능 API.

## 1. src/app/api/sessions/[id]/checkpoints/route.ts (신규)
- GET: 세션의 체크포인트 목록 (SessionCheckpointInfo[])
- POST: 체크포인트 생성. body: { name: string }
  - getPtyBackend(sessionId)로 스크롤백 가져옴
  - gzip 압축하여 scrollback 필드에 저장
  - cwd는 없으면 null

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPtyBackend } from '@/server/pty/ptyBackend';
import { gzipSync } from 'zlib';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const checkpoints = await prisma.sessionCheckpoint.findMany({
    where: { sessionId: params.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, sessionId: true, name: true, cwd: true, metadata: true, createdAt: true },
  });
  return NextResponse.json({ data: checkpoints.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })) });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const backend = getPtyBackend(params.id);
  const scrollback = backend?.getScrollback(params.id);
  const checkpoint = await prisma.sessionCheckpoint.create({
    data: {
      sessionId: params.id,
      name: body.name || 'checkpoint',
      scrollback: scrollback ? gzipSync(Buffer.from(scrollback)) : null,
    },
  });
  return NextResponse.json({ data: { ...checkpoint, createdAt: checkpoint.createdAt.toISOString() } }, { status: 201 });
}
```

## 2. src/app/api/sessions/[id]/fork/route.ts (신규)
- POST: 체크포인트에서 새 세션 생성. body: { checkpointId: string, name?: string }
  - 체크포인트의 세션에서 projectId, agentType 복사
  - sessionManager.createSession() 호출
  - 반환: 새 SessionInfo

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sessionManager } from '@/server/session/sessionManager';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const checkpoint = await prisma.sessionCheckpoint.findUnique({ where: { id: body.checkpointId } });
  if (!checkpoint) return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });
  
  const origSession = await prisma.agentSession.findUnique({ where: { id: checkpoint.sessionId } });
  if (!origSession) return NextResponse.json({ error: 'Original session not found' }, { status: 404 });
  
  const newSession = await sessionManager.createSession({
    projectId: origSession.projectId,
    agentType: origSession.agentType,
    name: body.name || 'Fork of ' + (origSession.name || origSession.id.slice(0,8)),
    resumeSessionRef: origSession.sessionRef,
  });
  return NextResponse.json({ data: newSession }, { status: 201 });
}
```

## 참고
- SessionCheckpointInfo 타입은 src/lib/types.ts에 정의됨
- params 패턴: { params: { id: string } }
- gzipSync: import { gzipSync } from 'zlib'

## Target Files
- `src/app/api/sessions/[id]/checkpoints/route.ts`
- `src/app/api/sessions/[id]/fork/route.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] GET /api/sessions/{id}/checkpoints가 체크포인트 목록 반환
- [ ] POST /api/sessions/{id}/checkpoints가 스크롤백 포함 체크포인트 생성
- [ ] POST /api/sessions/{id}/fork가 새 세션 생성
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
