# Orbit Component Map

> `/translate` 스킬이 참조하는 프로젝트 내부 요소 매핑 테이블.
> UI/UX 설명 → 실제 개발 요소 변환에 사용.

---

## UI 영역 → 컴포넌트 매핑

### 대시보드 (메인 화면)

| UI 요소 | 컴포넌트 | 파일 |
|---------|----------|------|
| 프로젝트 목록 (좌측 사이드바) | `ProjectList` | `src/components/dashboard/ProjectList.tsx` |
| 세션 목록 (우측) | `SessionList` | `src/components/dashboard/SessionList.tsx` |
| 전체 레이아웃 셸 | `Dashboard` | `src/components/dashboard/Dashboard.tsx` |
| 탭 워크스페이스 (터미널/파일/하네스) | `BorderlessWorkspace` | `src/components/dashboard/BorderlessWorkspace.tsx` |
| 로컬 프로젝트 추가 폼 | `AddProjectForm` | `src/components/dashboard/AddProjectForm.tsx` |
| SSH 프로젝트 추가 폼 | `AddSshProjectForm` | `src/components/dashboard/AddSshProjectForm.tsx` |
| Docker 프로젝트 추가 폼 | `AddDockerProjectForm` | `src/components/dashboard/AddDockerProjectForm.tsx` |
| 위험 명령 승인 배너 (상단) | `InterceptorBanner` | `src/components/dashboard/InterceptorBanner.tsx` |
| 명령 승인/거부 모달 | `InterceptorModal` | `src/components/dashboard/InterceptorModal.tsx` |
| 하네스 설정 패널 | `ProjectHarnessPanel` | `src/components/dashboard/ProjectHarnessPanel.tsx` |
| A/B 비교 터미널 | `ABCompare` | `src/components/dashboard/ABCompare.tsx` |
| 디렉토리 선택기 (로컬) | `DirectoryPicker` | `src/components/dashboard/DirectoryPicker.tsx` |
| 디렉토리 선택기 (원격) | `RemoteDirectoryPicker` | `src/components/dashboard/RemoteDirectoryPicker.tsx` |

### 터미널

| UI 요소 | 컴포넌트 | 파일 |
|---------|----------|------|
| xterm 터미널 렌더러 | `TerminalView` | `src/components/terminal/TerminalView.tsx` |
| 멀티 패인 터미널 관리 | `MultiTerminal` | `src/components/terminal/MultiTerminal.tsx` |
| 단일 터미널 패인 | `TerminalPane` | `src/components/terminal/TerminalPane.tsx` |
| 패인 분할 디바이더 | `SplitDivider` | `src/components/terminal/SplitDivider.tsx` |
| 재귀 패인 렌더러 | `PaneRenderer` | `src/components/terminal/PaneRenderer.tsx` |
| 전체 페이지 터미널 (/sessions/[id]) | `TerminalPage` | `src/components/terminal/TerminalPage.tsx` |
| 세션 메트릭스 패널 | `SessionMetricsPanel` | `src/components/terminal/SessionMetricsPanel.tsx` |
| 세션 다음 단계 패널 | `SessionNextSteps` | `src/components/terminal/SessionNextSteps.tsx` |
| 채팅 뷰 | `SessionChatbotView` | `src/components/terminal/SessionChatbotView.tsx` |
| 채팅 작성 독 | `SessionComposerDock` | `src/components/terminal/SessionComposerDock.tsx` |
| 모바일 채팅 터미널 | `MobileChatTerminal` | `src/components/terminal/MobileChatTerminal.tsx` |

### 그래프

| UI 요소 | 컴포넌트 | 파일 |
|---------|----------|------|
| 스킬 그래프 캔버스 | `SkillGraph` | `src/components/graph/SkillGraph.tsx` |
| 스킬 노드 | `SkillNode` | `src/components/graph/SkillNode.tsx` |
| 그래프 툴바 (줌/검색/생성) | `GraphToolbar` | `src/components/graph/GraphToolbar.tsx` |
| 연결(엣지) 패널 | `ConnectionPanel` | `src/components/graph/ConnectionPanel.tsx` |
| 라이브 트레이스 표시 | `LiveTrace` | `src/components/graph/LiveTrace.tsx` |

### 파일 탐색/편집

| UI 요소 | 컴포넌트 | 파일 |
|---------|----------|------|
| 파일 에디터 (CodeMirror) | `FileEditor` | `src/components/dashboard/FileEditor.tsx` |
| 사이드바 파일 트리 | `SidebarFileTree` | `src/components/dashboard/SidebarFileTree.tsx` |
| 프로젝트 파일 패널 | `ProjectFilesPanel` | `src/components/files/ProjectFilesPanel.tsx` |
| 코드 에디터 래퍼 | `CodeEditor` | `src/components/files/CodeEditor.tsx` |

### 모바일

| UI 요소 | 컴포넌트 | 파일 |
|---------|----------|------|
| PWA 레이아웃 | `MobileLayout` | `src/components/mobile/MobileLayout.tsx` |
| 가상 키보드 | `VirtualKeyboard` | `src/components/mobile/VirtualKeyboard.tsx` |

---

## API 엔드포인트 매핑

### 프로젝트 관련
| 동작 | 엔드포인트 | 메서드 | 라우트 파일 |
|------|-----------|--------|------------|
| 프로젝트 목록/생성 | `/api/projects` | GET/POST | `src/app/api/projects/route.ts` |
| 프로젝트 수정/삭제 | `/api/projects/[id]` | PATCH/DELETE | `src/app/api/projects/[id]/route.ts` |
| 파일 목록 | `/api/projects/[id]/files/list` | GET | `src/app/api/projects/[id]/files/list/route.ts` |
| 파일 읽기 | `/api/projects/[id]/files/read` | GET | `src/app/api/projects/[id]/files/read/route.ts` |
| 파일 쓰기 | `/api/projects/[id]/files/write` | PUT | `src/app/api/projects/[id]/files/write/route.ts` |
| 파일 생성/이름변경/삭제 | `/api/projects/[id]/files/{mkdir,rename,delete}` | POST | 각각 별도 route.ts |
| 하네스 설정 | `/api/projects/[id]/harness` | GET/PUT | `src/app/api/projects/[id]/harness/route.ts` |
| 워크스페이스 | `/api/projects/[id]/workspaces` | GET/POST | `src/app/api/projects/[id]/workspaces/route.ts` |

### 세션 관련
| 동작 | 엔드포인트 | 메서드 | 라우트 파일 |
|------|-----------|--------|------------|
| 세션 목록/생성 | `/api/sessions` | GET/POST | `src/app/api/sessions/route.ts` |
| 세션 수정/삭제 | `/api/sessions/[id]` | PATCH/DELETE | `src/app/api/sessions/[id]/route.ts` |
| 세션 명령 실행 | `/api/sessions/[id]/command` | POST | `src/app/api/sessions/[id]/command/route.ts` |
| 채팅 메시지 | `/api/sessions/[id]/chat-messages` | GET/POST | `src/app/api/sessions/[id]/chat-messages/route.ts` |

### SSH 관련
| 동작 | 엔드포인트 | 메서드 | 라우트 파일 |
|------|-----------|--------|------------|
| SSH 설정 목록/생성 | `/api/ssh-configs` | GET/POST | `src/app/api/ssh-configs/route.ts` |
| SSH 설정 수정/삭제 | `/api/ssh-configs/[id]` | PATCH/DELETE | `src/app/api/ssh-configs/[id]/route.ts` |
| SSH 연결 테스트 | `/api/ssh-configs/[id]/test` | POST | `src/app/api/ssh-configs/[id]/test/route.ts` |
| 원격 파일 탐색 | `/api/ssh-configs/[id]/browse` | GET | `src/app/api/ssh-configs/[id]/browse/route.ts` |

### 스킬/그래프
| 동작 | 엔드포인트 | 메서드 | 라우트 파일 |
|------|-----------|--------|------------|
| 그래프 조회/스킬 생성/위치 저장 | `/api/skills` | GET/POST/PUT | `src/app/api/skills/route.ts` |
| 스킬 수정/삭제/엣지 관리 | `/api/skills/[id]` | PUT/DELETE | `src/app/api/skills/[id]/route.ts` |

### 인터셉터
| 동작 | 엔드포인트 | 메서드 | 라우트 파일 |
|------|-----------|--------|------------|
| 규칙 관리 | `/api/interceptor/rules` | GET/POST/PUT | `src/app/api/interceptor/rules/route.ts` |
| 모드 관리 | `/api/interceptor/mode` | GET/PUT | `src/app/api/interceptor/mode/route.ts` |

---

## 서버 모듈 매핑

### 핵심 매니저
| 기능 | 모듈 | 파일 | 주요 메서드 |
|------|------|------|------------|
| PTY 프로세스 관리 | `ptyManager` | `src/server/pty/ptyManager.ts` | `createSession()`, `attachSession()`, `resize()` |
| 세션 생명주기 | `sessionManager` | `src/server/session/sessionManager.ts` | `createSession()`, `listSessions()`, `killSession()` |
| SSH 연결 풀 | `sshManager` | `src/server/ssh/sshManager.ts` | `connect()`, `executeCommand()` |
| 원격 PTY | `remotePtyManager` | `src/server/ssh/remotePty.ts` | `createRemoteSession()`, `attachRemoteSession()` |
| 스킬 그래프 | `graphManager` | `src/server/graph/graphManager.ts` | `createSkill()`, `getGraphState()` |
| 명령 인터셉터 | `commandInterceptor` | `src/server/pty/interceptor.ts` | `interceptCommand()`, `approveCommand()` |
| 프로젝트 파일 | `projectFileManager` | `src/server/files/projectFiles.ts` | `listDirectory()`, `readFile()`, `writeFile()` |
| 세션 메트릭스 | `sessionMetricsManager` | `src/server/observability/sessionMetrics.ts` | `recordEvent()`, `getSnapshot()` |

### Socket.io 핸들러
| 도메인 | 파일 |
|--------|------|
| 터미널 (attach/detach/data/resize) | `src/server/socket/handlers/terminal.ts` |
| SSH (connect/disconnect/status) | `src/server/socket/handlers/ssh.ts` |
| 그래프 (subscribe/trace) | `src/server/socket/handlers/graph.ts` |
| 인터셉터 (approve/deny/mode) | `src/server/socket/handlers/interceptor.ts` |
| 옵저버빌리티 (metrics) | `src/server/socket/handlers/observability.ts` |

---

## Socket.io 이벤트 매핑

### 서버 → 클라이언트
| 이벤트 | 용도 | 관련 컴포넌트 |
|--------|------|--------------|
| `terminal-data` | 터미널 출력 | TerminalView |
| `terminal-data-compressed` | 압축 터미널 출력 | TerminalView |
| `session-update` | 세션 메타 변경 | Dashboard, TerminalPage |
| `session-list` | 세션 목록 갱신 | Dashboard, MultiTerminal |
| `session-exit` | 세션 종료 | TerminalView, TerminalPane |
| `session-ready` | 세션 준비 완료 | TerminalView |
| `ssh-status` | SSH 연결 상태 | AddSshProjectForm |
| `skill-trace` | 스킬 실행 추적 | LiveTrace |
| `interceptor-pending` | 명령 승인 대기 | usePendingApprovals |
| `interceptor-resolved` | 승인 결과 | usePendingApprovals |
| `session-metrics` | 메트릭스 스냅샷 | useSessionMetrics |

### 클라이언트 → 서버
| 이벤트 | 용도 | 관련 컴포넌트 |
|--------|------|--------------|
| `terminal-data` | 사용자 입력 | TerminalView |
| `terminal-resize` | 터미널 크기 변경 | TerminalView |
| `session-attach` / `session-detach` | 세션 연결/해제 | TerminalPane, MultiTerminal |
| `session-list` | 목록 요청 | Dashboard |
| `ssh-connect` / `ssh-disconnect` | SSH 연결 | AddSshProjectForm |
| `graph-subscribe` / `graph-unsubscribe` | 그래프 구독 | SkillGraph |
| `interceptor-approve` / `interceptor-deny` | 명령 승인/거부 | InterceptorModal |
| `metrics-subscribe` / `metrics-unsubscribe` | 메트릭스 구독 | SessionMetricsPanel |

---

## 공유 훅 & 유틸리티

| 훅/유틸 | 파일 | 용도 |
|---------|------|------|
| `useSocket` | `src/lib/useSocket.ts` | Socket.io 연결 상태 |
| `useMobile` | `src/lib/hooks/useMobile.ts` | 모바일/PWA 감지 |
| `usePendingApprovals` | `src/lib/hooks/usePendingApprovals.ts` | 인터셉터 승인 관리 |
| `useSessionMetrics` | `src/lib/hooks/useSessionMetrics.ts` | 세션 메트릭스 구독 |
| `paneTree` | `src/lib/paneTree.ts` | 패인 트리 조작 |
| `getSocket` | `src/lib/socketClient.ts` | Socket.io 클라이언트 싱글턴 |
| `types` | `src/lib/types.ts` | 공유 타입 정의 |
| `constants` | `src/lib/constants.ts` | 상수 (COLS, ROWS, 타임아웃 등) |

---

## Prisma 모델

| 모델 | 용도 |
|------|------|
| `Project` | 프로젝트 (LOCAL/SSH/DOCKER) |
| `SshConfig` | SSH 연결 설정 |
| `AgentSession` | 에이전트 세션 (active/paused/terminated) |
| `Skill` | 스킬 노드 (이름, 타입, 위치) |
| `SkillEdge` | 스킬 간 연결 |
| `InterceptorRule` | 명령 차단 규칙 |

---

## 페이지 라우트

| URL | 페이지 | 컴포넌트 |
|-----|--------|----------|
| `/` | 메인 대시보드 | Dashboard |
| `/sessions/[id]` | 전체 터미널 | TerminalPage |
| `/graph` | 스킬 그래프 | SkillGraph |
| `/compare` | A/B 비교 | ABCompare |
| `/login` | 로그인 | LoginPage |
