# Tasks — Todo

## 현재 작업

- [ ] Phase 1: 인프라 구축

## 계획

### Phase 1: 인프라 구축
- [ ] Next.js 14 + TypeScript 프로젝트 초기화
- [ ] Prisma + SQLite 스키마 설정 (Project, SshConfig, AgentSession, Skill)
- [ ] node-pty 기반 PTY Manager 구현
- [ ] xterm.js + WebGL Addon 터미널 컴포넌트 구현
- [ ] Socket.io 서버/클라이언트 연동 (터미널 데이터 스트림)
- [ ] 로컬 프로젝트 등록 및 에이전트 세션 실행
- [ ] 세션 인덱싱 + --resume 기능 구현

### Phase 2: 원격 확장
- [ ] ssh2 기반 SSH 터널링 구현
- [ ] 원격 서버 세션 스캐너
- [ ] PWA 설정 (next-pwa)
- [ ] 모바일 가상 키보드 UI (Ctrl, Tab, Esc, Arrow)

### Phase 3: 시각화 및 하네싱
- [ ] React Flow 스킬 그래프 에디터
- [ ] 에이전트 로그 파싱 → 실시간 노드 애니메이션
- [ ] 드래그 앤 드롭 스킬 연결

### Phase 4: 고도화
- [ ] 명령어 인터셉터 (위험 명령 승인 대기)
- [ ] 좀비 프로세스 GC (24h 미활동 자동 회수)
- [ ] 대역폭 Delta 최적화
- [ ] A/B 테스트 및 세션 성능 비교 도구

## 결과

-

## 관련 노트

- `CLAUDE.md` — 프로젝트 아키텍처 및 컨벤션
- `update_notes/experiments/` — 실험 기록
