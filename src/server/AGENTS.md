# Server Layer Rules

## Architecture Boundary
- 이 디렉토리는 백엔드 전용. `src/components/`를 절대 import하지 마라.
- `src/lib/types.ts`와 `src/lib/constants.ts`만 공유 의존성으로 사용.
- React, DOM API 사용 금지.

## Modules
- `pty/` — PTY 프로세스 관리 (node-pty 싱글턴)
- `ssh/` — SSH 터널링 (ssh2), RemotePty, DeltaStream
- `session/` — Prisma CRUD, GC, resume
- `socket/` — Socket.io 이벤트 핸들러 레지스트리
- `graph/` — 스킬 그래프 CRUD, 트레이스 감지

## Conventions
- 파일명: camelCase (`ptyManager.ts`)
- 싱글턴: 모듈 레벨 인스턴스, 명시적 init/destroy
- Socket 이벤트: kebab-case (`terminal-data`, `session-update`)
- 에러 핸들링: try-catch + 의미 있는 에러 메시지, 절대 swallow하지 마라
- Prisma: `src/lib/prisma.ts`의 공유 인스턴스 사용

## Key Interfaces
- `PtyBackend` — PTY 추상화 (로컬/원격 공통)
- `SocketHandler` — 핸들러 레지스트리 패턴
- `SessionManager` — CRUD + GC + resume
