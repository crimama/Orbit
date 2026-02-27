# Tasks — Todo

## 현재 작업

- [x] Phase 1: 인프라 구축

## 계획

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
