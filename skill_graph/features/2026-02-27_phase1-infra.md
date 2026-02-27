# Phase 1: 인프라 구축 — 2026-02-27

> **상태**: 🟢 완료
> **Phase**: Phase 1
> **keywords**: pty, terminal, socket.io, custom-server, session, dashboard, xterm

---

## 요구사항

로컬 환경에서 PTY 기반 웹 터미널 + 세션 resume가 동작하는 최소 프로덕트.
- Custom Server가 Socket.io + Next.js를 동시 서빙
- 웹 터미널에서 로컬 쉘 명령 실행 가능
- 브라우저 탭 닫고 재접속 시 PTY 세션 유지
- 대시보드에서 프로젝트/세션 목록 조회
- 세션 선택 → 터미널 연결 → 명령 실행 E2E 동작
- 24시간 미활동 세션 자동 정리 (GC)

## 설계

### 변경 범위
- `server.ts` — 커스텀 서버 엔트리포인트 (신규)
- `src/server/pty/` — PTY Manager
- `src/server/session/` — Session Manager
- `src/server/socket/` — Socket.io Handler
- `src/lib/` — 타입, 상수, Prisma 싱글턴, Socket 클라이언트
- `src/app/api/` — REST API routes
- `src/components/terminal/` — xterm.js 컴포넌트
- `src/components/dashboard/` — 대시보드 UI
- `src/app/sessions/[id]/` — 터미널 페이지 라우트

### 접근 방식
- **Custom Server**: `http.createServer` + Next.js handler + Socket.io
- **PTY 지속성**: 글로벌 Map, Socket과 분리 (disconnect ≠ destroy)
- **Scrollback**: 세션당 50,000자 원형 버퍼
- **GC**: 1시간 주기, 24시간 idle 기준

---

## 구현 내역

- [x] 의존성 설치 (socket.io, node-pty, @xterm/xterm, tsx)
- [x] package.json scripts 변경 (dev → tsx --watch)
- [x] next.config.mjs — experimental.serverComponentsExternalPackages
- [x] tsconfig.server.json 생성
- [x] 공유 타입/상수/Prisma 싱글턴
- [x] PTY Manager (싱글턴, 다중 리스너, scrollback)
- [x] Session Manager (Prisma CRUD, GC)
- [x] Socket Handler (attach/detach/resize/disconnect)
- [x] Custom Server (server.ts)
- [x] REST API Routes (projects, sessions)
- [x] Socket.io 클라이언트 + useSocket hook
- [x] TerminalView (xterm.js + WebGL + FitAddon)
- [x] TerminalPage (헤더 + 상태)
- [x] Dashboard (2패널: 프로젝트/세션)
- [x] globals.css에 xterm CSS 추가

### 주요 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `server.ts` | 신규 — Custom Server 엔트리포인트 |
| `src/lib/types.ts` | 신규 — Socket 이벤트, PTY, Session, Project 타입 |
| `src/lib/constants.ts` | 신규 — PTY/GC/Socket 상수 |
| `src/lib/prisma.ts` | 신규 — PrismaClient 싱글턴 |
| `src/lib/socketClient.ts` | 신규 — Socket.io 클라이언트 |
| `src/lib/useSocket.ts` | 신규 — React hook |
| `src/server/pty/ptyManager.ts` | 신규 — PTY 프로세스 매니저 |
| `src/server/session/sessionManager.ts` | 신규 — Session CRUD + GC |
| `src/server/socket/handler.ts` | 신규 — Socket.io 이벤트 핸들러 |
| `src/app/api/projects/route.ts` | 신규 — GET/POST |
| `src/app/api/projects/[id]/route.ts` | 신규 — GET/DELETE |
| `src/app/api/sessions/route.ts` | 신규 — GET/POST |
| `src/app/api/sessions/[id]/route.ts` | 신규 — GET/DELETE |
| `src/components/terminal/TerminalView.tsx` | 신규 — xterm.js 컴포넌트 |
| `src/components/terminal/TerminalPage.tsx` | 신규 — 터미널 페이지 래퍼 |
| `src/components/dashboard/Dashboard.tsx` | 신규 — 2패널 대시보드 |
| `src/components/dashboard/ProjectList.tsx` | 신규 |
| `src/components/dashboard/SessionList.tsx` | 신규 |
| `src/components/dashboard/AddProjectForm.tsx` | 신규 |
| `src/app/sessions/[id]/page.tsx` | 신규 — 터미널 페이지 라우트 |
| `src/app/page.tsx` | 수정 — Dashboard 렌더링 |
| `package.json` | 수정 — scripts |
| `next.config.mjs` | 수정 — serverComponentsExternalPackages |
| `.gitignore` | 수정 — /dist 추가 |
| `src/app/globals.css` | 수정 — xterm CSS import |

---

## 테스트

- [x] `npx tsc --noEmit` — 타입 체크 통과
- [x] `npm run lint` — ESLint 통과
- [x] `npm run build` — 프로덕션 빌드 성공
- [x] `npm run dev` — 서버 부팅 + Socket.io 경로 출력 확인

---

## 관련 노트
- 선행: `skill_graph/decisions/2026-02-27_skill-strategy.md`
- 후속: Phase 2 (SSH 터널링 + PWA)
