# App Router Layer Rules

## Architecture Boundary
- Next.js App Router 페이지 및 API 라우트.
- `src/components/`, `src/lib/` import 가능.
- `src/server/`는 API 라우트(`api/` 하위)에서만 import 가능.
- 페이지 컴포넌트(`page.tsx`)에서 `src/server/` 직접 import 금지.

## Structure
- `api/` — REST API 라우트 (GET/POST/PUT/DELETE)
- `page.tsx` — 대시보드 홈
- `sessions/[id]/page.tsx` — 터미널 세션
- `graph/page.tsx` — 스킬 그래프 시각화
- `compare/page.tsx` — A/B 비교

## Conventions
- API 라우트: NextRequest/NextResponse 패턴
- 에러 응답: `{ error: string }` 형태 통일
- 동적 라우트: `[id]` 디렉토리 패턴
- 서버 컴포넌트: 기본값. 클라이언트 필요 시 "use client" 명시
