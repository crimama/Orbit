# Agent-Orbit Development Outline

> 이 문서는 프로젝트의 North Star이다. Scope creep 방지와 Phase 경계를 명확히 한다.

## Vision & Non-Negotiable Constraints

**비전**: 어떠한 환경에서도, 사용자의 AI 에이전트와 스킬을 시각적으로 통제하고 지속시키는 지휘 통제실

### 불변 제약조건

1. **TypeScript strict mode** — 모든 소스에 적용, `any` 사용 금지
2. **SQLite only** — Prisma 경유, 외부 DB 서버 의존 없음
3. **PTY 지속성** — 브라우저 탭 닫아도 PTY 프로세스 유지 (24h GC)
4. **Socket.io** — 모든 실시간 통신의 단일 채널 (터미널 + 그래프 + 세션)
5. **모바일 동등 제어** — 데스크탑에서 가능한 모든 조작을 모바일에서도 수행 가능

### Scope Fence (하지 않는 것)

- 자체 LLM 서빙/추론 — 에이전트는 외부 프로세스로 실행
- 멀티테넌트/사용자 인증 — 셀프호스팅 단일 사용자 전제
- 에이전트 마켓플레이스 — 스킬 그래프는 사용자 정의만 지원
- Kubernetes/Docker 오케스트레이션 — SSH + PTY 레벨에서 해결

---

## Dependency Installation Order

> **규칙**: 선행 Phase가 완료되지 않으면 다음 Phase 의존성 설치 금지.
> `/dep-install` 스킬이 이 순서를 강제한다.

### Phase 1: 인프라 구축

```bash
npm install socket.io socket.io-client node-pty @xterm/xterm @xterm/addon-fit @xterm/addon-webgl
```

### Phase 2: 원격 확장

```bash
npm install ssh2 next-pwa
npm install -D @types/ssh2
```

### Phase 3: 시각화

```bash
npm install @xyflow/react
```

### Phase 4: 고도화

```bash
# TBD — Phase 3 완료 후 결정
```

---

## Phase 1: 인프라 구축

> 로컬 환경에서 PTY 기반 터미널 + 세션 resume가 동작하는 최소 프로덕트

### 모듈 경계

| # | 모듈 | 핵심 파일 | 책임 |
|---|------|----------|------|
| 1 | **Custom Server** | `server.ts` | Next.js + Socket.io 통합 HTTP 서버 |
| 2 | **PTY Manager** | `src/server/pty/ptyManager.ts` | PTY 생성/파괴/IO 라우팅 |
| 3 | **Socket Handler** | `src/server/socket/handler.ts` | Socket.io 이벤트 등록 및 디스패치 |
| 4 | **Terminal Component** | `src/components/terminal/TerminalView.tsx` | xterm.js + WebGL 렌더링 |
| 5 | **Session Manager** | `src/server/session/sessionManager.ts` | 세션 CRUD + 파일 감시 + resume |
| 6 | **Dashboard Page** | `src/app/page.tsx`, `src/components/dashboard/` | 프로젝트/세션 목록 UI |
| 7 | **API Routes** | `src/app/api/projects/`, `src/app/api/sessions/` | REST 엔드포인트 |

### 핵심 인터페이스

```typescript
// PTY Manager
interface PtyInstance {
  id: string;
  sessionId: string;
  process: IPty;
  lastActivity: Date;
}

// Socket Events (kebab-case)
"terminal-data"    // client ↔ server: 터미널 IO
"terminal-resize"  // client → server: 크기 변경
"session-update"   // server → client: 세션 상태 변경
"session-list"     // client ↔ server: 세션 목록 요청/응답

// Session Manager
interface SessionInfo {
  id: string;
  projectId: string;
  agentType: string;
  status: "active" | "idle" | "dead";
  lastContext: string;
}
```

### Done Criteria

- [ ] Custom Server가 Socket.io + Next.js를 동시 서빙
- [ ] 웹 터미널에서 로컬 쉘 명령 실행 가능
- [ ] 브라우저 탭 닫고 재접속 시 PTY 세션 유지
- [ ] 대시보드에서 프로젝트/세션 목록 조회
- [ ] 세션 선택 → 터미널 연결 → 명령 실행 E2E 동작
- [ ] 24시간 미활동 세션 자동 정리 (GC)

### Phase 1 Exclusions

- SSH 원격 연결
- PWA / Service Worker
- 모바일 전용 레이아웃
- 스킬 그래프 시각화

---

## Phase 2: 원격 확장

> SSH 터널을 통한 원격 서버 에이전트 관리 + PWA 오프라인 지원

### 모듈 경계

| # | 모듈 | 핵심 파일 | 책임 |
|---|------|----------|------|
| 1 | **SSH Manager** | `src/server/ssh/sshManager.ts` | SSH 연결 풀 + 터널 관리 |
| 2 | **Remote Scanner** | `src/server/ssh/remoteScanner.ts` | 원격 서버 에이전트/세션 탐지 |
| 3 | **PWA Config** | `next.config.mjs`, `public/manifest.json` | Service Worker + 오프라인 캐시 |
| 4 | **Virtual Keyboard** | `src/components/mobile/VirtualKeyboard.tsx` | 모바일 보조키 (Ctrl, Tab, Esc 등) |

### Done Criteria

- [ ] SSH 설정 등록 → 원격 서버 터미널 접속
- [ ] 원격 서버의 에이전트 세션 자동 탐지 + 목록 표시
- [ ] PWA 설치 가능 (홈 화면 추가)
- [ ] 모바일에서 가상 키보드로 특수키 입력
- [ ] SSH 연결 끊김 시 자동 재연결 + 사용자 알림

---

## Phase 3: 시각화

> React Flow 기반 스킬/에이전트 그래프 시각화 + 실행 추적

### 모듈 경계

| # | 모듈 | 핵심 파일 | 책임 |
|---|------|----------|------|
| 1 | **Skill Graph Editor** | `src/components/graph/SkillGraph.tsx` | React Flow 노드/엣지 편집기 |
| 2 | **Live Trace** | `src/components/graph/LiveTrace.tsx` | 실행 중인 노드 하이라이트 + 로그 |
| 3 | **D&D Connection** | `src/components/graph/ConnectionPanel.tsx` | 드래그&드롭으로 스킬 연결 |

### Done Criteria

- [ ] 스킬 노드 생성/삭제/연결 + 저장
- [ ] 에이전트 실행 시 해당 노드 실시간 하이라이트
- [ ] 모바일에서도 그래프 조회 및 기본 조작 가능

---

## Phase 4: 고도화

> 보안 가드레일, 성능 최적화, A/B 비교 기능

### 모듈 경계

| # | 모듈 | 핵심 파일 | 책임 |
|---|------|----------|------|
| 1 | **Command Interceptor** | `src/server/pty/interceptor.ts` | 위험 명령 감지 + 승인 대기 |
| 2 | **Session GC** | `src/server/session/gc.ts` | 24h 미활동 세션 자동 정리 |
| 3 | **Delta Stream** | `src/server/ssh/deltaStream.ts` | SSH 터미널 Delta 전송 최적화 |
| 4 | **A/B Comparison** | `src/components/dashboard/ABCompare.tsx` | 에이전트 성능 비교 뷰 |

### Done Criteria

- [ ] 위험 명령 실행 시 웹 UI에서 승인/거부 팝업
- [ ] 모바일 환경에서 체감 지연 200ms 이하 (Delta 최적화)
- [ ] 두 에이전트 세션의 결과를 나란히 비교 가능

---

## Cross-Phase Rules

1. **Phase 완료 전 다음 Phase 의존성 설치 금지** — `/dep-install` 스킬이 게이트
2. **Phase 경계에서 MEMORY.md 갱신** — Current Status 섹션 업데이트
3. **각 Phase 시작 시 ADR 작성** — `skill_graph/decisions/`에 기술 결정 기록
4. **Phase 완료 시 Feature Note 작성** — `skill_graph/features/`에 구현 기록
5. **Done Criteria 전부 체크 안 되면 Phase 미완료** — 부분 완료 불가
