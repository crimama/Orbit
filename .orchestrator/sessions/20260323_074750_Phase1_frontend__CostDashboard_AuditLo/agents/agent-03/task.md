# Task: TaskBoard Component

## Agent
agent-03

## Status
pending

## Description
멀티에이전트 태스크 보드 (칸반 형태).

## 파일: src/components/dashboard/TaskBoard.tsx (신규)
'use client' 컴포넌트.

### Props
interface TaskBoardProps {
  projectId: string;
}

### 기능
1. 마운트 시 GET /api/projects/{projectId}/tasks 호출
2. 3열 칸반: Pending | In Progress | Done
3. 각 태스크 카드: title, description (truncated), assignee, priority 뱃지
4. 태스크 추가: 상단에 input + 'Add' 버튼 (POST /api/projects/{projectId}/tasks)
5. 상태 변경: 카드에 status 변경 버튼들 (PATCH /api/projects/{projectId}/tasks/{taskId})
6. 삭제: 카드에 X 버튼 (DELETE /api/projects/{projectId}/tasks/{taskId})

### API
- GET /api/projects/{id}/tasks → { data: AgentTaskInfo[] }
- POST /api/projects/{id}/tasks body: { title, description?, priority? }
- PATCH /api/projects/{id}/tasks/{taskId} body: { status?, assignee?, result? }
- DELETE /api/projects/{id}/tasks/{taskId}

### 타입
import type { AgentTaskInfo, AgentTaskStatus, ApiResponse, ApiError } from '@/lib/types';

### 스타일링
- 3열 그리드: grid grid-cols-3 gap-3
- 각 열 헤더: text-xs font-medium uppercase text-neutral-500
- 태스크 카드: rounded-lg border border-neutral-800 bg-neutral-950/70 p-3
- priority 뱃지: high(빨강), medium(주황), low(회색)
- 상태 버튼: 작은 화살표 아이콘

### 참고
src/components/dashboard/SshVaultPanel.tsx — fetch/CRUD 패턴

## Target Files
- `src/components/dashboard/TaskBoard.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] 3열 칸반 레이아웃
- [ ] 태스크 추가/삭제
- [ ] 상태 변경
- [ ] 다크 테마
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
