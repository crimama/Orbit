# Task: Token Tracker + Cost API

## Agent
agent-02

## Status
pending

## Description
PTY 출력에서 토큰/비용 정보를 파싱하여 DB에 저장하고 API로 조회하는 시스템.

## 1. src/server/observability/tokenTracker.ts (신규)
PTY 출력에서 에이전트별 토큰 사용량 패턴을 감지한다.

```typescript
import { prisma } from '@/lib/prisma';

// Claude Code: 'Total cost: $X.XX' 또는 'total_cost_usd'
// Codex: 'tokens used\nN,NNN'
const COST_PATTERN = /Total cost:\s*\$([0-9.]+)/i;
const TOKENS_PATTERN = /tokens used\n([\d,]+)/i;

class TokenTracker {
  async processOutput(sessionId: string, data: string): Promise<void> {
    // 패턴 매치 시 SessionTokenLog에 기록
    const costMatch = COST_PATTERN.exec(data);
    if (costMatch) {
      await prisma.sessionTokenLog.create({
        data: { sessionId, estimatedCost: parseFloat(costMatch[1]) },
      });
    }
  }
}
export const tokenTracker = new TokenTracker();
```

## 2. src/app/api/sessions/[id]/tokens/route.ts (신규)
GET: 세션별 토큰 로그 조회. 집계된 총 토큰, 총 비용 반환.
params.id로 sessionId 접근. 기존 패턴: src/app/api/ssh-configs/[id]/route.ts

## 3. src/app/api/analytics/cost/route.ts (신규)
GET: 프로젝트별/기간별 비용 집계.
쿼리 파라미터: projectId (optional), from (ISO date), to (ISO date).
groupBy로 세션별 합계.

## 4. src/server/socket/handlers/terminal.ts 수정 (최소)
기존 extractOscEvents 함수 아래에서 tokenTracker.processOutput(sessionId, data) 호출 추가.
extractOscEvents 다음 줄에 한 줄 추가만 하면 됨:
```
void tokenTracker.processOutput(sessionId, cleaned);
```

## 참고
- prisma import: import { prisma } from '@/lib/prisma'
- SessionTokenInfo 타입은 src/lib/types.ts에 정의됨
- NextResponse import: import { NextResponse } from 'next/server'
- 기존 terminal.ts의 onData 콜백 구조 참고

## Target Files
- `src/server/observability/tokenTracker.ts`
- `src/app/api/sessions/[id]/tokens/route.ts`
- `src/app/api/analytics/cost/route.ts`
- `src/server/socket/handlers/terminal.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] tokenTracker.processOutput()가 패턴 감지 시 DB 기록
- [ ] GET /api/sessions/{id}/tokens가 토큰 집계 반환
- [ ] GET /api/analytics/cost가 비용 집계 반환
- [ ] terminal.ts에 tokenTracker 호출 추가
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
