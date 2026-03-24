# Task: Multi-Agent Task + FileLock Manager

## Agent
agent-04

## Status
pending

## Description
멀티에이전트 조율을 위한 태스크 매니저와 파일 잠금 매니저.

## 1. src/server/coordination/taskManager.ts (신규)
```typescript
import { prisma } from '@/lib/prisma';
import type { AgentTaskInfo } from '@/lib/types';

function toInfo(row: any): AgentTaskInfo {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function listTasks(projectId: string): Promise<AgentTaskInfo[]> {
  const tasks = await prisma.agentTask.findMany({ where: { projectId }, orderBy: { priority: 'desc' } });
  return tasks.map(toInfo);
}

export async function createTask(data: { projectId: string; title: string; description?: string; priority?: number; deps?: string[]; files?: string[] }): Promise<AgentTaskInfo> {
  const task = await prisma.agentTask.create({
    data: { projectId: data.projectId, title: data.title, description: data.description, priority: data.priority ?? 0, deps: data.deps ? JSON.stringify(data.deps) : null, files: data.files ? JSON.stringify(data.files) : null },
  });
  return toInfo(task);
}

export async function updateTask(id: string, data: Partial<{ status: string; assignee: string; result: string }>): Promise<AgentTaskInfo> {
  const task = await prisma.agentTask.update({ where: { id }, data });
  return toInfo(task);
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.agentTask.delete({ where: { id } });
}
```

## 2. src/server/coordination/fileLockManager.ts (신규)
```typescript
import { prisma } from '@/lib/prisma';
import type { FileLockInfo } from '@/lib/types';

export async function acquireLock(projectId: string, filePath: string, sessionId: string, description?: string): Promise<FileLockInfo> {
  const lock = await prisma.fileLock.create({ data: { projectId, filePath, sessionId, description } });
  return { ...lock, createdAt: lock.createdAt.toISOString() };
}

export async function releaseLock(projectId: string, filePath: string): Promise<void> {
  await prisma.fileLock.deleteMany({ where: { projectId, filePath } });
}

export async function listLocks(projectId: string): Promise<FileLockInfo[]> {
  const locks = await prisma.fileLock.findMany({ where: { projectId } });
  return locks.map(l => ({ ...l, createdAt: l.createdAt.toISOString() }));
}

export async function detectConflicts(projectId: string, files: string[]): Promise<FileLockInfo[]> {
  const locks = await prisma.fileLock.findMany({ where: { projectId, filePath: { in: files } } });
  return locks.map(l => ({ ...l, createdAt: l.createdAt.toISOString() }));
}
```

## 3. src/app/api/projects/[id]/tasks/route.ts (신규)
- GET: listTasks(projectId)
- POST: createTask({ projectId, ...body })

## 4. src/app/api/projects/[id]/tasks/[taskId]/route.ts (신규)
- PATCH: updateTask(taskId, body)
- DELETE: deleteTask(taskId)

## 5. src/app/api/projects/[id]/locks/route.ts (신규)
- GET: listLocks(projectId)

## 참고
- AgentTaskInfo, FileLockInfo 타입은 src/lib/types.ts에 정의됨
- prisma import: import { prisma } from '@/lib/prisma'
- 라우트 params: { params: { id: string } } 또는 { params: { id: string; taskId: string } }

## Target Files
- `src/server/coordination/taskManager.ts`
- `src/server/coordination/fileLockManager.ts`
- `src/app/api/projects/[id]/tasks/route.ts`
- `src/app/api/projects/[id]/tasks/[taskId]/route.ts`
- `src/app/api/projects/[id]/locks/route.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] listTasks/createTask/updateTask/deleteTask 정상 작동
- [ ] acquireLock/releaseLock/detectConflicts 정상 작동
- [ ] API 라우트 GET/POST/PATCH/DELETE 동작
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
