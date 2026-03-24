# Task: AuditLogPanel Component

## Agent
agent-02

## Status
pending

## Description
감사 로그를 표시하는 패널 컴포넌트.

## 파일: src/components/dashboard/AuditLogPanel.tsx (신규)
'use client' 컴포넌트.

### 기능
1. 마운트 시 GET /api/audit?limit=30 호출
2. 이벤트 타입별 필터 드롭다운 (all, interceptor_approve, interceptor_deny, session_create, session_terminate)
3. 타임라인 형태로 이벤트 표시:
   - 각 이벤트: 아이콘(타입별) + action 텍스트 + 시간 (time ago)
   - interceptor_approve → 초록 아이콘
   - interceptor_deny → 빨간 아이콘
   - session_create → 파란 아이콘
   - session_terminate → 회색 아이콘
4. 빈 상태: '감사 로그가 없습니다'

### API
GET /api/audit?eventType=xxx&limit=30 → { data: AuditLogInfo[] }

### 타입
import type { AuditLogInfo, ApiResponse, ApiError } from '@/lib/types';

AuditLogInfo: { id, sessionId, projectId, eventType, action, detail, createdAt }

### 스타일링
- 기존 다크 테마
- 타임라인: 왼쪽에 아이콘 dot, 오른쪽에 텍스트
- 각 항목: border-b border-neutral-800/50 px-3 py-2
- 컴팩트하게. 스크롤 가능한 max-h-80

### 참고
src/components/dashboard/SshVaultPanel.tsx — 리스트 패턴

## Target Files
- `src/components/dashboard/AuditLogPanel.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] 감사 로그 타임라인 렌더링
- [ ] 이벤트 타입 필터
- [ ] 시간 표시 (time ago)
- [ ] 다크 테마
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
