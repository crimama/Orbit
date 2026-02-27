# Phase 2-4 병렬 구현 — 2026-02-28

> **상태**: 🟢 완료
> **Phase**: Phase 2 / 3 / 4
> **keywords**: SSH, PWA, 모바일, 스킬그래프, React Flow, 인터셉터, Delta, A/B비교

---

## 요구사항

Phase 1(인프라) 완료 후, 나머지 3개 Phase를 동시에 구현:
- **Phase 2**: SSH 원격 접속 + PWA 모바일 지원 + 가상 키보드
- **Phase 3**: React Flow 기반 스킬 그래프 시각화 + 라이브 트레이스
- **Phase 4**: 위험 명령 인터셉터 + SSH Delta 압축 + 세션 A/B 비교

공유 파일(types.ts, constants.ts, schema.prisma, socket handler) 충돌 없는 병렬 전략 필요.

## 설계

### 변경 범위
- `src/server/ssh/` — SshManager, RemotePty, RemoteScanner, DeltaStream
- `src/server/graph/` — GraphManager, TraceDetector
- `src/server/pty/` — PtyBackend 인터페이스, Interceptor, InterceptorRules
- `src/server/socket/handlers/` — terminal, ssh, graph, interceptor (레지스트리)
- `src/components/graph/` — SkillGraph, SkillNode, LiveTrace, GraphToolbar, ConnectionPanel
- `src/components/mobile/` — VirtualKeyboard, MobileLayout
- `src/components/dashboard/` — AddSshProjectForm, InterceptorModal, InterceptorBanner, ABCompare
- `src/app/api/` — ssh-configs, skills, interceptor/rules
- `src/app/graph/`, `src/app/compare/` — 신규 페이지
- `src/lib/hooks/` — useMobile, usePendingApprovals
- `public/` — manifest.json, PWA 아이콘

### 접근 방식
1. **Pre-work 순차 처리**: 공유 파일(types, constants, schema, socket handler 리팩토링) 먼저 일괄 수정
2. **3개 Phase 병렬 서브에이전트**: 각 Phase가 독립 파일만 담당, 공유 파일 수정 금지
3. **통합 단계**: handler.ts에 3개 Phase 핸들러 등록, terminal-data에 interceptor 통합, 대시보드 네비게이션

### API / 인터페이스
```typescript
// PtyBackend — 로컬/원격 통합 추상화
interface PtyBackend {
  has(id: string): boolean;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  getScrollback(id: string): string;
  onData(id: string, cb: (data: string) => void): () => void;
  onExit(id: string, cb: (code: number) => void): () => void;
  destroy(id: string): void;
  getIdleSessions(maxIdleMs: number): { id: string }[];
}

// Socket Handler Registry
type SocketHandlerRegistrar = (io: OrbitServer, socket: OrbitSocket) => void;

// 신규 API 엔드포인트
// GET/POST   /api/ssh-configs
// GET/PUT/DELETE /api/ssh-configs/[id]
// POST       /api/ssh-configs/[id]/test
// GET/POST/PUT /api/skills
// GET/PUT/DELETE /api/skills/[id]
// GET/POST   /api/interceptor/rules
```

---

## 구현 내역

- [x] Pre-work: 의존성 설치 (ssh2, @xyflow/react, @types/ssh2)
- [x] Pre-work: Socket handler 레지스트리 패턴 리팩토링
- [x] Pre-work: PtyBackend 인터페이스 추출 + ptyManager implements
- [x] Pre-work: types.ts / constants.ts 전체 Phase 타입·상수 추가
- [x] Pre-work: Prisma 스키마 확장 (Skill, SkillEdge, InterceptorRule) + 마이그레이션
- [x] Phase 2: SshManager (연결 풀, 자동 재연결, key/password 인증)
- [x] Phase 2: RemotePtyManager (PtyBackend 구현, SSH Channel 래핑)
- [x] Phase 2: RemoteScanner (원격 Claude 히스토리 스캔)
- [x] Phase 2: SSH Socket Handler + SSH Config REST API
- [x] Phase 2: AddSshProjectForm + SessionManager SSH 분기
- [x] Phase 2: VirtualKeyboard + MobileLayout + useMobile 훅
- [x] Phase 2: PWA (manifest.json, 아이콘, meta 태그)
- [x] Phase 3: GraphManager (Prisma CRUD + 배치 위치 업데이트)
- [x] Phase 3: TraceDetector (PTY 출력 → 스킬 패턴 감지)
- [x] Phase 3: SkillGraph + SkillNode + LiveTrace + GraphToolbar + ConnectionPanel
- [x] Phase 3: Skills REST API + /graph 페이지
- [x] Phase 4: CommandInterceptor (입력 버퍼 → 패턴 매칭 → block/warn)
- [x] Phase 4: InterceptorRules 기본 시딩 + REST API
- [x] Phase 4: DeltaStream (zlib 압축)
- [x] Phase 4: InterceptorModal + InterceptorBanner + usePendingApprovals
- [x] Phase 4: ABCompare + /compare 페이지
- [x] 통합: handler.ts에 4개 핸들러 등록
- [x] 통합: terminal-data에 interceptor.intercept() 통합
- [x] 통합: Dashboard 네비게이션 (Graph, Compare, SSH 프로젝트 폼)

### 주요 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/server/socket/handler.ts` | 레지스트리 패턴으로 리팩토링, 4개 핸들러 등록 |
| `src/server/socket/types.ts` | OrbitServer, OrbitSocket, SocketHandlerRegistrar 타입 추출 (신규) |
| `src/server/socket/handlers/terminal.ts` | getPtyBackend() 사용 + interceptor 통합 |
| `src/server/socket/handlers/ssh.ts` | ssh-connect/disconnect/status 이벤트 (신규) |
| `src/server/socket/handlers/graph.ts` | graph-subscribe/unsubscribe + skill-trace (신규) |
| `src/server/socket/handlers/interceptor.ts` | approve/deny 이벤트 (신규) |
| `src/server/pty/ptyBackend.ts` | PtyBackend 인터페이스 + 레지스트리 (신규) |
| `src/server/pty/ptyManager.ts` | PtyBackend implements + registerPtyBackend |
| `src/server/pty/interceptor.ts` | CommandInterceptor 엔진 (신규) |
| `src/server/pty/interceptorRules.ts` | 기본 위험 패턴 시딩 (신규) |
| `src/server/ssh/sshManager.ts` | SSH 연결 풀 싱글턴 (신규) |
| `src/server/ssh/remotePty.ts` | PtyBackend over SSH (신규) |
| `src/server/ssh/remoteScanner.ts` | 원격 세션 스캔 (신규) |
| `src/server/ssh/deltaStream.ts` | zlib 압축 (신규) |
| `src/server/graph/graphManager.ts` | 그래프 Prisma CRUD (신규) |
| `src/server/graph/traceDetector.ts` | 스킬 호출 감지 (신규) |
| `src/server/session/sessionManager.ts` | SSH 프로젝트 분기, 원격 PTY 지원 |
| `src/lib/types.ts` | 전 Phase 타입 추가 (SSH, Graph, Interceptor) |
| `src/lib/constants.ts` | 전 Phase 상수 추가 |
| `src/lib/hooks/useMobile.ts` | 모바일 감지 훅 (신규) |
| `src/lib/hooks/usePendingApprovals.ts` | 인터셉터 상태 관리 훅 (신규) |
| `src/components/graph/*` | React Flow 5개 컴포넌트 (신규) |
| `src/components/mobile/*` | VirtualKeyboard + MobileLayout (신규) |
| `src/components/dashboard/*` | AddSshProjectForm, InterceptorModal/Banner, ABCompare (신규) |
| `src/components/dashboard/Dashboard.tsx` | 네비게이션 + SSH 폼 + 인터셉터 배너 통합 |
| `src/app/api/ssh-configs/**` | 3개 API 라우트 (신규) |
| `src/app/api/skills/**` | 2개 API 라우트 (신규) |
| `src/app/api/interceptor/**` | 1개 API 라우트 (신규) |
| `src/app/graph/page.tsx` | 그래프 페이지 (신규) |
| `src/app/compare/page.tsx` | A/B 비교 페이지 (신규) |
| `src/app/layout.tsx` | PWA manifest + theme-color meta |
| `server.ts` | sshManager 초기화 + shutdown |
| `next.config.mjs` | ssh2 external packages 추가 |
| `prisma/schema.prisma` | Skill 확장 + SkillEdge + InterceptorRule 추가 |
| `public/manifest.json` | PWA 매니페스트 (신규) |
| `public/icons/*` | PWA 아이콘 2개 (신규) |

---

## 테스트

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npm run build` — 성공 (13 routes)
- [x] `npm run lint` — 0 errors, 0 warnings
- [ ] SSH 원격 연결 수동 테스트
- [ ] 스킬 그래프 CRUD 수동 테스트
- [ ] 인터셉터 block/warn 수동 테스트
- [ ] 모바일 VirtualKeyboard 수동 테스트
- [ ] A/B Compare 수동 테스트

---

## 회고

### 잘된 점
- Pre-work에서 공유 파일을 먼저 일괄 수정하여 3개 Phase 완전 병렬 실행 가능
- PtyBackend 추상화로 로컬/원격 PTY 투명하게 교체
- Socket handler 레지스트리 패턴으로 Phase별 독립적 핸들러 등록

### 개선할 점
- next-pwa 대신 수동 PWA 구성 (deprecated 라이브러리 회피)
- E2E 테스트 부재 — 수동 검증 필요

### 교훈 → `tasks/lessons.md` 반영 여부
- [x] 반영 불필요 (기존 병렬 전략 패턴과 동일)

---

## 관련 노트
- 선행: Phase 1 인프라 구축 (2026-02-27)
- 후속: E2E 테스트, 성능 최적화, 프로덕션 배포
