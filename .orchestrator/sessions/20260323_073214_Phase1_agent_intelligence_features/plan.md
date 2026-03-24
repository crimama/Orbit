# Phase 1: Agent Intelligence Features

## Foundation (완료)
- Prisma 스키마: SessionTokenLog, AuditLog, SessionCheckpoint, AgentTask, FileLock
- types.ts: 모든 관련 타입 정의
- InterceptorRule에 riskTier, riskScore 필드 추가

## Agent 할당

### Agent-01: Audit Logger + API
- src/server/audit/auditLogger.ts (신규)
- src/app/api/audit/route.ts (신규)
- src/server/pty/interceptor.ts (approve/deny 시 감사 로그)
- src/server/session/sessionManager.ts (create/terminate 시 감사 로그)

### Agent-02: Token Tracker + Cost API
- src/server/observability/tokenTracker.ts (신규)
- src/app/api/sessions/[id]/tokens/route.ts (신규)
- src/app/api/analytics/cost/route.ts (신규)
- src/server/socket/handlers/terminal.ts (토큰 패턴 파싱)

### Agent-03: Session Checkpoint + Fork API
- src/app/api/sessions/[id]/checkpoints/route.ts (신규)
- src/app/api/sessions/[id]/fork/route.ts (신규)
- src/server/session/sessionManager.ts (checkpoint/fork 메서드)

### Agent-04: Multi-Agent Coordination Backend
- src/server/coordination/taskManager.ts (신규)
- src/server/coordination/fileLockManager.ts (신규)
- src/app/api/projects/[id]/tasks/route.ts (신규)
- src/app/api/projects/[id]/tasks/[taskId]/route.ts (신규)
- src/app/api/projects/[id]/locks/route.ts (신규)

### Agent-05: Frontend — CostDashboard + AuditLogPanel
- src/components/dashboard/CostDashboard.tsx (신규)
- src/components/dashboard/AuditLogPanel.tsx (신규)
- src/components/dashboard/Dashboard.tsx (Home에 배치)

### Agent-06: Frontend — TaskBoard + Checkpoint UI
- src/components/dashboard/TaskBoard.tsx (신규)
- src/components/terminal/TerminalPane.tsx (checkpoint/fork 버튼)
