# Tasks — Todo

## 현재 작업

- [x] 모바일 UI `type command` send 시 터미널 포커스만 이동하고 실행되지 않는 문제 수정
- [x] Phase 1: 인프라 구축
- [x] 프로젝트 별 하네스 엔지니어링 관리 + oh-my-opencode 특화 + 세션 UI/UX 개선
- [x] YOLO 모드 버그 수정 + 세션별 YOLO 구현

## 이번 세션 (2026-03-12)

### YOLO 모드 버그 수정 + 세션별 YOLO

**근본 원인**: API route의 `commandInterceptor.invalidateCache()`가 Next.js 번들의 별도 모듈 인스턴스에서 실행됨. Socket.io 핸들러가 사용하는 실제 인터셉터 인스턴스의 캐시에는 영향 없음.

- [x] 1. `interceptor.ts` — 세션별 모드 맵 추가 (`sessionModes: Map<string, InterceptorMode>`)
- [x] 2. `interceptor.ts` — `intercept()`에서 세션 모드 우선 체크 로직 추가
- [x] 3. Socket 이벤트 추가 — `set-interceptor-mode`, `set-session-mode` (REST 대신 Socket 경유)
- [x] 4. `types.ts` — 새 소켓 이벤트 타입 정의
- [x] 5. Dashboard 글로벌 YOLO 토글 → Socket 경유로 변경
- [x] 6. 터미널/세션 UI에 세션별 YOLO 토글 추가
- [x] 7. 타입체크/빌드 검증

## 계획

### 모바일 command send 실행 버그 수정 (2026-03-12)

- [x] 모바일 `type command` 입력/전송 컴포넌트와 이벤트 흐름 확인
- [x] 터미널 write/enter 처리 경로에서 모바일 전송 누락 원인 수정
- [x] 타입체크 또는 관련 검증 수행 후 결과 기록

### Phase 1: 인프라 구축

- [x] Next.js 14 + TypeScript 프로젝트 초기화
- [x] Prisma + SQLite 스키마 설정 (Project, SshConfig, AgentSession, Skill)
- [x] node-pty 기반 PTY Manager 구현
- [x] xterm.js + WebGL Addon 터미널 컴포넌트 구현
- [x] Socket.io 서버/클라이언트 연동 (터미널 데이터 스트림)
- [x] 로컬 프로젝트 등록 및 에이전트 세션 실행
- [x] 세션 인덱싱 + --resume 기능 구현
- [x] Custom Server (server.ts) — Next.js + Socket.io 통합
- [x] REST API Routes (projects, sessions CRUD)
- [x] Dashboard UI (프로젝트/세션 2패널)
- [x] 24h 미활동 세션 GC

### Phase 2: 원격 확장

- [x] ssh2 기반 SSH 터널링 구현
- [x] 원격 서버 세션 스캐너
- [ ] PWA 설정 (next-pwa)
- [x] 모바일 가상 키보드 UI (Ctrl, Tab, Esc, Arrow)

### Phase 3: 시각화 및 하네싱

- [x] React Flow 스킬 그래프 에디터
- [x] 에이전트 로그 파싱 → 실시간 노드 애니메이션
- [x] 드래그 앤 드롭 스킬 연결

### Phase 4: 고도화

- [x] 명령어 인터셉터 (위험 명령 승인 대기)
- [x] 좀비 프로세스 GC (24h 미활동 자동 회수)
- [ ] 대역폭 Delta 최적화
- [x] A/B 테스트 및 세션 성능 비교 도구

## 결과

### 프로젝트 하네스 + 채팅형 UX (2026-02-28)

- 프로젝트 별 하네스 설정이 DB/REST/UI 레벨에서 동작하도록 연결
- oh-my-opencode 기본 프리셋(JSON) 즉시 적용 기능 제공
- 세션 UI를 카드/칩 기반으로 정리해 기존 터미널 대비 가독성과 접근성을 개선
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과
- `npm test`는 스크립트 미정의로 실행 불가(기존 상태)

### 모바일 command send 실행 버그 수정 (2026-03-12)

- 모바일 `Send`가 소켓의 현재 attach 상태에만 기대지 않도록 `/api/sessions/[id]/command` 경로로 통일
- 모바일 chat terminal에 전송 중 상태와 실패 메시지 추가
- `npx tsc --noEmit` 실행 시 오류 출력 없이 종료

### Phase 1 (2026-02-27)

- Custom Server: `tsx --watch server.ts` — Next.js + Socket.io 동시 서빙
- PTY Manager: node-pty 기반, 50KB scrollback, 다중 리스너 지원
- Session Manager: Prisma CRUD + 1h 주기 GC (24h idle 기준)
- Socket Handler: attach/detach/resize 이벤트 처리, disconnect 시 PTY 유지
- API Routes: projects/sessions REST CRUD
- Terminal UI: xterm.js + WebGL + FitAddon + ResizeObserver
- Dashboard: 프로젝트 목록(좌) + 세션 목록(우) 2패널 레이아웃
- 빌드 + 타입 체크 + lint 모두 통과

## 관련 노트

- `CLAUDE.md` — 프로젝트 아키텍처 및 컨벤션
- `skill_graph/features/2026-02-27_phase1-infra.md` — Phase 1 구현 기록
- `skill_graph/decisions/2026-03-12_happy-mobile-yolo-research.md` — Happy Coder YOLO 패턴 리서치
