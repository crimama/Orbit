# Task: SSH Quick-Connect Backend

## Agent
agent-01

## Status
pending

## Description
SSH Config ID만으로 바로 터미널 세션을 생성하는 Quick Connect 백엔드를 구현한다.

## 1. Prisma Schema 변경
prisma/schema.prisma의 Project 모델에 adhoc 필드를 추가:
  adhoc Boolean @default(false)

추가 후 npx prisma migrate dev --name add-project-adhoc 실행.

## 2. Quick Connect API 엔드포인트
src/app/api/ssh-configs/[id]/connect/route.ts (신규 파일):

POST /api/ssh-configs/{id}/connect
요청 본문: { cols?: number, rows?: number }
응답: { data: SessionInfo }

로직:
1. sshConfigId로 SshConfig 조회 (없으면 404)
2. 해당 sshConfigId로 adhoc=true인 Project 검색 (findFirst where: { sshConfigId: id, adhoc: true })
3. 없으면 새 Project 생성:
   - name: config.label || config.host (예: 'my-server' 또는 '192.168.1.1')
   - type: 'SSH'
   - path: config.defaultPath || '~'
   - sshConfigId: id
   - adhoc: true
   - color: '#f59e0b' (SSH 기본 색상)
4. sessionManager.createSession({ projectId: project.id, agentType: 'terminal', cols, rows }) 호출
5. SessionInfo 반환

## 3. 프로젝트 목록에서 adhoc 필터링
src/app/api/projects/route.ts의 GET 핸들러에서:
기존 findMany 쿼리에 where: { adhoc: false } 조건 추가 (또는 NOT adhoc).
adhoc 프로젝트는 사용자에게 보이지 않아야 함.

## 참고 파일
- src/server/session/sessionManager.ts: createSession 메서드 시그니처 확인
- src/lib/types.ts: SessionInfo, CreateSessionRequest 타입 확인
- src/app/api/projects/route.ts: 기존 프로젝트 API 패턴 참고
- src/app/api/ssh-configs/[id]/test/route.ts: SSH config ID 라우트 패턴 참고

## 주의사항
- prisma import는 '@/lib/prisma'에서: import { prisma } from '@/lib/prisma'
- sessionManager import: import { sessionManager } from '@/server/session/sessionManager'
- NextResponse 사용: import { NextResponse } from 'next/server'
- 에러 처리: try/catch로 감싸서 적절한 HTTP 상태코드 반환

## Target Files
- `prisma/schema.prisma`
- `src/app/api/ssh-configs/[id]/connect/route.ts`
- `src/app/api/projects/route.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] Prisma migration 성공
- [ ] POST /api/ssh-configs/{id}/connect가 SessionInfo 반환
- [ ] 동일 sshConfigId에 대해 adhoc 프로젝트 재사용
- [ ] GET /api/projects에서 adhoc 프로젝트 필터링

## Notes
(Orchestrator may add coordination notes here)
