# Shared Library Rules

## Architecture Boundary
- 이 디렉토리는 최하위 의존 계층. 다른 `src/` 디렉토리를 import하지 마라.
- `src/server/`, `src/components/`, `src/app/` 모두 금지.
- 오직 외부 패키지와 이 디렉토리 내부 파일만 import 가능.

## Files
- `types.ts` — 모든 Socket/API/모델 타입 (단일 진실 소스)
- `constants.ts` — 설정값 상수 (PTY, GC, SSH, Graph, Delta, Interceptor)
- `prisma.ts` — PrismaClient 싱글턴
- `socketClient.ts` — Socket.io 클라이언트 래퍼
- `useSocket.ts` — React Socket.io 훅
- `hooks/` — 공유 React 훅

## Conventions
- 타입 추가 시 `types.ts`에 Phase 주석 섹션 구분
- 상수 추가 시 `constants.ts`에 관련 Phase 섹션에 추가
- 새 파일은 반드시 camelCase
