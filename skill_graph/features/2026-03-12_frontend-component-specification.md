# Agent-Orbit 프론트엔드 상세명세서 — 2026-03-12

> **상태**: 🟢 완료
> **Phase**: Phase 1–4 전체
> **keywords**: frontend, components, specification, dashboard, terminal, graph, mobile, workspace, pane, socket

---

## 개요

Agent-Orbit의 프론트엔드는 AI 에이전트를 시각적으로 통제하고 지속시키는 **지휘 통제실** UI를 제공한다.
Next.js 14 App Router 기반이며, xterm.js(WebGL), React Flow, Socket.io, Tailwind CSS를 핵심 스택으로 사용한다.

### 기술 스택
| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router, SSR + CSR 하이브리드) |
| 언어 | TypeScript (strict mode) |
| 터미널 렌더링 | xterm.js + WebGL Addon + FitAddon |
| 그래프 시각화 | React Flow (@xyflow/react) |
| 실시간 통신 | Socket.io (WebSocket) |
| 스타일링 | Tailwind CSS 3.4 (Dark Theme) |
| 모바일 | PWA (next-pwa) + 가상 키보드 |

### 전체 통계
- 컴포넌트: **34개** (.tsx)
- 페이지: **6개** (home, session, graph, compare, login, layout)
- 커스텀 훅: **4개**
- 유틸리티: **5개+**

---

## 1. 페이지 구조 (src/app/)

### 1.1 Root Layout (`layout.tsx`)
| 항목 | 내용 |
|------|------|
| 역할 | 전역 HTML 구조, 폰트, PWA 메타데이터 설정 |
| 폰트 | Geist Sans / Geist Mono (로컬) |
| PWA | manifest 링크, Apple mobile meta tags |
| CSS | globals.css (Tailwind base) |

### 1.2 Home (`/`) — `page.tsx`
| 항목 | 내용 |
|------|------|
| 렌더링 컴포넌트 | `<Dashboard />` |
| 역할 | 메인 대시보드 진입점 — 프로젝트/세션/워크스페이스 통합 관리 |

### 1.3 Session (`/sessions/[id]`) — `sessions/[id]/page.tsx`
| 항목 | 내용 |
|------|------|
| 동적 파라미터 | `id` (세션 UUID) |
| 쿼리 파라미터 | `workspaceId` (워크스페이스 레이아웃 ID, optional) |
| 렌더링 컴포넌트 | `<TerminalPage>` |
| 기능 | 전체 화면 터미널, 세션 제목 편집, 뷰 모드 전환 (chat/terminal), 메트릭스 패널, 다음 단계 제안 |

### 1.4 Graph (`/graph`) — `graph/page.tsx`
| 항목 | 내용 |
|------|------|
| 쿼리 파라미터 | `projectId` |
| 렌더링 컴포넌트 | `<SkillGraph projectId={projectId} />` |
| 기능 | React Flow 기반 스킬 그래프 시각화, 프로젝트 선택기 |

### 1.5 Compare (`/compare`) — `compare/page.tsx`
| 항목 | 내용 |
|------|------|
| 쿼리 파라미터 | `left`, `right` (세션 ID) |
| 렌더링 컴포넌트 | `<ABCompare>` |
| 기능 | 좌/우 세션 선택기, 병렬 터미널 뷰, 독립 Socket.io 연결 |

### 1.6 Login (`/login`) — `login/page.tsx`
| 항목 | 내용 |
|------|------|
| 렌더링 컴포넌트 | `<LoginPageContent>` |
| 기능 | 비밀번호 인증 (최초 설정 / 로그인), 쿠키 기반 세션 유지, 5초 타임아웃 |

---

## 2. 대시보드 구성요소 (src/components/dashboard/)

### 2.1 Dashboard (`Dashboard.tsx`) — 메인 오케스트레이터

> **파일 크기**: ~61.7KB — 프로젝트 전체의 중앙 제어 컴포넌트

| 항목 | 내용 |
|------|------|
| Props | 없음 (루트 컴포넌트) |
| 역할 | 프로젝트 선택, 세션 관리, 인터셉터 승인, 파일 뷰어, 워크스페이스 전환을 하나의 화면에서 총괄 |

**주요 상태:**
| 상태 | 타입 | 설명 |
|------|------|------|
| `projects` | `ProjectInfo[]` | 등록된 프로젝트 목록 |
| `selectedProject` | `ProjectInfo \| null` | 현재 선택된 프로젝트 |
| `sessions` | `SessionInfo[]` | 활성/전체/일시정지 세션 |
| `sessionViewMode` | `string` | 세션 뷰 모드 |
| `projectPaneMode` | `"terminal" \| "files" \| "harness"` | 우측 패널 모드 |
| `addProjectMode` | `string` | 프로젝트 추가 모드 (local/ssh/docker) |
| `inlineSessionId` | `string \| null` | 인라인 터미널 세션 |
| `pendingApprovals` | `PendingApproval[]` | 인터셉터 대기 승인 목록 |
| `viewedFile` | `ViewedFile \| null` | 현재 열린 파일 |

**주요 콜백:**
- `onSelectProject(ProjectInfo)` — 프로젝트 선택
- `onDeleteProject(id)` — 프로젝트 삭제
- `onRenameProject(id, newName)` — 프로젝트 이름 변경
- `onCreateSession(projectId, agentType)` — 새 세션 생성
- `onKillSession(sessionId)` — 세션 종료
- `onApproveIntercept()` / `onDenyIntercept()` — 인터셉터 승인/거부

**Socket.io 이벤트:**
- emit: `dashboard-join`, `session-list`
- on: `session-list`, `session-update`, `interceptor-pending`, `interceptor-resolved`

**자식 컴포넌트:**
```
Dashboard
├── ProjectList
├── SessionList
├── SidebarFileTree
├── BorderlessWorkspace
├── AddProjectForm / AddSshProjectForm / AddDockerProjectForm
├── InterceptorBanner
└── InterceptorModal
```

---

### 2.2 BorderlessWorkspace (`BorderlessWorkspace.tsx`) — 탭 기반 워크스페이스

| 항목 | 내용 |
|------|------|
| 역할 | 세션/파일/하네스를 탭으로 관리하는 워크스페이스 컨테이너 |

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `sessions` | `SessionInfo[]` | 사용 가능한 세션 목록 |
| `selectedProject` | `ProjectInfo \| null` | 현재 프로젝트 |
| `projectPaneMode` | `"terminal" \| "files" \| "harness"` | 패널 모드 |
| `inlineSessionId` | `string \| null` | 초기 세션 |
| `inlineWorkspaceId` | `string \| null` | 초기 워크스페이스 |
| `viewedFile` | `ViewedFile?` | 열어볼 파일 |
| `onCloseFile` | `() => void` | 파일 닫기 콜백 |
| `onKillSession` | `(sessionId) => void` | 세션 종료 콜백 |

**주요 상태:**
| 상태 | 타입 | 설명 |
|------|------|------|
| `tabs` | `WorkspaceTab[]` | 탭 목록 (session/files/harness/file-view) |
| `activePanel` | `"left" \| "right"` | 활성 패널 |
| `leftTabId` / `rightTabId` | `string \| null` | 각 패널의 활성 탭 |
| `layoutMode` | `"split" \| "left" \| "right"` | 레이아웃 모드 |
| `splitRatio` | `number` (0–1) | 분할 비율 |

**핵심 기능:**
- 드래그 앤 드롭으로 탭을 패널 간 이동
- 패널 분할/합치기
- Props 변경 시 워크스페이스 자동 복원
- 파일 뷰어 통합

**자식 컴포넌트:** `MultiTerminal`, `FileEditor`, `ProjectHarnessPanel`, `SplitDivider`

---

### 2.3 ProjectList (`ProjectList.tsx`) — 프로젝트 목록 관리

| 항목 | 내용 |
|------|------|
| 역할 | 프로젝트 표시, 이름 편집, 색상 변경, 경로/컨테이너 설정 |

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `projects` | `ProjectInfo[]` | 프로젝트 목록 |
| `selectedId` | `string \| null` | 선택된 프로젝트 ID |
| `onSelect` | `(ProjectInfo) => void` | 선택 콜백 |
| `onDelete` | `(id) => void` | 삭제 콜백 |
| `onRename` | `(id, newName) => void` | 이름 변경 |
| `onUpdateConfig` | `(id, config) => void` | 경로/컨테이너 업데이트 |
| `onChangeColor` | `(id, color) => void` | 색상 변경 |

**핵심 기능:**
- 더블클릭으로 이름 편집
- 색상 피커 모달
- 경로 편집 + 디렉토리 브라우저 (로컬/원격/도커)

---

### 2.4 SessionList (`SessionList.tsx`) — 세션 목록

| 항목 | 내용 |
|------|------|
| 역할 | 세션을 프로젝트별로 그룹화하여 표시, 드래그 앤 드롭 지원 |

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `sessions` | `SessionInfo[]` | 세션 목록 |
| `onTerminate` | `(id) => void` | 세션 종료 |
| `onResume` | `(sessionRef, agentType) => void` | 세션 재개 |
| `onRename` | `(id, newName) => void` | 이름 변경 (optional) |
| `onOpenSession` | `(sessionId) => void` | 세션 열기 (미제공 시 router.push) |

**핵심 기능:**
- 드래그 앤 드롭 (활성 세션만)
- 상태 표시 (active 🟢 / paused 🟡 / terminated ⚫)
- 마지막 컨텍스트 표시
- 인라인 이름 변경
- Resume / Kill / Rename 버튼

---

### 2.5 AddProjectForm (`AddProjectForm.tsx`) — 로컬 프로젝트 생성

| Props | `onCreated(ProjectInfo)` |
|-------|--------------------------|
| 상태 | name, color, path, loading, error, showPicker |
| 기능 | 디렉토리 피커, 경로에서 자동 이름 추출 |

### 2.6 AddSshProjectForm (`AddSshProjectForm.tsx`) — SSH/Docker 프로젝트 생성

| 항목 | 내용 |
|------|------|
| 모드 | `"project"` (프로젝트 생성) / `"vault"` (SSH 설정 관리) |
| 기능 | SSH 연결 테스트, 기존 SSH 프로필 선택, 원격 디렉토리 브라우저, 도커 컨테이너 열거, 점프 호스트(프록시) 지원 |

**복합 상태:** host, port, username, authMethod, jumpHost, dockerContainer, sshConfigId, connectionTest

### 2.7 AddDockerProjectForm (`AddDockerProjectForm.tsx`) — 도커 프로젝트 생성

| 항목 | 내용 |
|------|------|
| 연결 타입 | `"local"` / `"ssh"` |
| 기능 | 로컬/원격 도커 접근, 컨테이너 열거, 디렉토리 브라우저 |

---

### 2.8 InterceptorBanner (`InterceptorBanner.tsx`) — 인터셉터 배너

| Props | 타입 | 설명 |
|-------|------|------|
| `pendingCount` | `number` | 대기 중인 승인 수 |
| `latestCommand` | `string?` | 최신 명령어 스니펫 |
| `onClick` | `() => void` | 클릭 시 모달 열기 |

**시각 효과:** 펄스 애니메이션, 승인 카운트, 명령어 미리보기

### 2.9 InterceptorModal (`InterceptorModal.tsx`) — 명령어 승인/거부 모달

| Props | 타입 | 설명 |
|-------|------|------|
| `approval` | `PendingApproval \| null` | 승인 대상 |
| `onApprove` | `() => void` | 승인 |
| `onDeny` | `() => void` | 거부 |

**기능:** 명령어 표시, 매칭 규칙 표시, 심각도 표시, 30초 자동 거부 카운트다운

---

### 2.10 SidebarFileTree (`SidebarFileTree.tsx`) — 사이드바 파일 트리

| Props | 타입 | 설명 |
|-------|------|------|
| `projectId` | `string` | 프로젝트 ID |
| `files` | `{name, path, isDir}[]` | 파일 목록 |
| `activePath` | `string?` | 현재 열린 파일 경로 |
| `onFileOpen` | `(path, content) => void` | 파일 열기 콜백 |

**기능:** 디렉토리 Lazy-load 확장, 파일 클릭 시 내용 fetch, 확장/로딩 시각 표시

### 2.11 FileEditor (`FileEditor.tsx`) — 파일 에디터

| Props | 타입 | 설명 |
|-------|------|------|
| `projectId` | `string` | 프로젝트 ID |
| `filePath` | `string` | 파일 경로 |
| `initialContent` | `string` | 초기 내용 |
| `onClose` | `() => void` | 닫기 |

**기능:** Ctrl+S 저장, 저장 상태 표시 (saving/saved/error), 더티 플래그 (`*`)

### 2.12 ProjectHarnessPanel (`ProjectHarnessPanel.tsx`) — 하네스 설정 패널

| Props | `projectId: string` |
|-------|---------------------|
| 역할 | AI 에이전트 하네스 구성 (oh-my-opencode, claude-code, codex, terminal) |

**기능:**
- 프로바이더 선택
- 가이드 모드 (폼 UI) vs JSON 에디터
- 권한 제어 (allow / ask / deny)
- 설정 영속화

### 2.13 ABCompare (`ABCompare.tsx`) — A/B 세션 비교

| Props | `leftSessionId`, `rightSessionId` |
|-------|-------------------------------------|
| 기능 | 세션 드롭다운 선택기, 독립 Socket.io 인스턴스 × 2, 반응형 (모바일 스택) |

### 2.14 DirectoryPicker / RemoteDirectoryPicker

| 컴포넌트 | 역할 |
|----------|------|
| `DirectoryPicker.tsx` | 로컬 파일시스템 브라우저 (디렉토리 목록, 상위 탐색, 경로 입력) |
| `RemoteDirectoryPicker.tsx` | 원격(SSH/Docker) 파일시스템 브라우저 (Home/$ROOT 퀵 버튼, 경로 탐색) |

---

## 3. 터미널 구성요소 (src/components/terminal/)

### 3.1 TerminalPage (`TerminalPage.tsx`) — 전체 화면 세션 뷰

| 항목 | 내용 |
|------|------|
| Props | `sessionId`, `initialWorkspaceId?`, `projectName?` |
| 역할 | 세션 전용 전체 화면 레이아웃 |

**주요 상태:**
| 상태 | 설명 |
|------|------|
| `sessions` | 점프 리스트용 세션 목록 |
| `jumpTarget` | 현재 세션 |
| `titleDraft` / `editingTitle` | 제목 편집 |
| `viewMode` | `"chat"` \| `"terminal"` |

**자식 컴포넌트:** `MultiTerminal`, `SessionMetricsPanel`, `SessionNextSteps`, `SessionChatbotView`

---

### 3.2 MultiTerminal (`MultiTerminal.tsx`) — 워크스페이스 레이아웃 매니저

> 페인(Pane) 트리 구조로 터미널을 분할·배치하는 핵심 컴포넌트

| 항목 | 내용 |
|------|------|
| 역할 | 여러 터미널 세션을 트리 구조의 분할 페인으로 관리 |

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `initialSessionId` | `string \| null` | 초기 세션 |
| `initialWorkspaceId` | `string \| null` | 복원할 워크스페이스 ID |
| `autoRestoreWorkspace` | `boolean` | 자동 복원 여부 |
| `runtimeStorageKey` | `string?` | localStorage 키 |
| `onKillSession` | `(sessionId) => void` | 세션 종료 |

**주요 상태:**
| 상태 | 타입 | 설명 |
|------|------|------|
| `root` | `PaneNode` | 페인 트리 (재귀 구조) |
| `activePaneId` | `string` | 활성 페인 |
| `sockets` | `Map<paneId, Socket>` | 페인별 독립 소켓 |
| `socketStates` | `Map<paneId, boolean>` | 소켓 연결 상태 |
| `sessions` | `SessionInfo[]` | 드롭다운용 세션 목록 |
| `workspaces` | `WorkspaceLayoutInfo[]` | 저장된 워크스페이스 |

**핵심 메서드:**
| 메서드 | 설명 |
|--------|------|
| `splitPane(paneId, direction)` | 페인 수평/수직 분할 |
| `closePane(paneId)` | 페인 닫기 |
| `updateLeafSession(paneId, sessionId)` | 페인의 세션 변경 |
| `swapSessions(source, target)` | 두 페인의 세션 교환 |
| `dropSession(paneId, sessionId, position)` | 드래그 앤 드롭으로 세션 배치 |

**Socket.io:** 페인마다 독립 소켓 생성, 워크스페이스 영속화 API 호출

---

### 3.3 PaneRenderer (`PaneRenderer.tsx`) — 재귀 페인 렌더러

| 항목 | 내용 |
|------|------|
| 역할 | PaneNode 트리를 재귀적으로 렌더링 |
| 리프 노드 | → `TerminalPane` 렌더링 |
| 분할 노드 | → `SplitDivider` + 자식 `PaneRenderer` × 2 |

**Props:** `node`, `activePaneId`, `sockets`, `socketStates`, `sessions`, `leafCount`, `exitedPanes`, + 다수 콜백 (onActivate, onSplit, onClose, onSelectSession, onDropSession, onSwapPanes, onMovePane, onRatioChange, onPaneExit, onKillSession)

---

### 3.4 TerminalPane (`TerminalPane.tsx`) — 단일 터미널 페인

| 항목 | 내용 |
|------|------|
| 역할 | 세션 선택기 + 터미널 뷰 + 페인 제어 버튼 |

**Props:**
| Prop | 설명 |
|------|------|
| `paneId` | 페인 고유 ID |
| `sessionId` | 연결된 세션 (null 가능) |
| `socket` | Socket.io 인스턴스 |
| `connected` | 연결 상태 |
| `isActive` | 활성 페인 여부 |
| `exited` | 종료 여부 |
| `canClose` | 닫기 가능 여부 |
| `sessions` | 드롭다운용 세션 목록 |
| `workspace?` | 워크스페이스 컨트롤 |

**핵심 기능:**
- 세션 선택 드롭다운
- 분할 버튼 (수평 H / 수직 V)
- 닫기 버튼
- 드래그 앤 드롭 세션 수신 (dataTransfer)
- 페인 교환/이동
- **세션별 YOLO 토글** (인터셉터 모드 개별 전환)
- 모바일 키보드 인셋 처리

---

### 3.5 TerminalView (`TerminalView.tsx`) — xterm.js 래퍼

> 실제 터미널 렌더링을 담당하는 최하위 컴포넌트

| 항목 | 내용 |
|------|------|
| 역할 | xterm.js 인스턴스 생성·관리, PTY 연결, 입출력 처리 |

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `sessionId` | `string` | 세션 ID |
| `socket` | `OrbitSocket?` | 커스텀 소켓 (없으면 글로벌) |
| `connected` | `boolean?` | 연결 상태 |
| `onExit` | `(exitCode) => void` | 종료 콜백 |
| `onInputReady` | `(fn) => void` | 입력 함수 노출 |

**핵심 기능:**
- xterm.js + FitAddon Lazy 로딩
- 다크 테마 (배경 `#0b1220`, 시안 커서)
- 세션 attach/detach
- 리사이즈 이벤트 처리 (ResizeObserver)
- 압축 데이터 수신 (`terminal-data-compressed`)
- **50K 스크롤백** 버퍼

**Socket.io 이벤트:**
| 방향 | 이벤트 | 설명 |
|------|--------|------|
| emit | `session-attach` | 세션 연결 |
| emit | `terminal-resize` | 리사이즈 전송 |
| emit | `terminal-data` | 사용자 입력 전송 |
| on | `terminal-data` | PTY 출력 수신 |
| on | `terminal-data-compressed` | 압축 출력 수신 |
| on | `session-exit` | 세션 종료 수신 |
| on | `session-ready` | 세션 준비 완료 |

---

### 3.6 SplitDivider (`SplitDivider.tsx`) — 분할 핸들

| Props | `direction` (`"horizontal"` \| `"vertical"`), `onRatioChange(ratio)` |
|-------|----------------------------------------------------------------------|
| 기능 | 마우스 드래그로 비율 조정, 더블클릭으로 50:50 리셋 |
| 커서 | col-resize (수직) / row-resize (수평) |

---

### 3.7 SessionMetricsPanel (`SessionMetricsPanel.tsx`) — 세션 메트릭스

| Props | `sessionId: string` |
|-------|---------------------|
| Hook | `useSessionMetrics(sessionId)` |
| 표시 항목 | file_edit, command_run, test_result, error, tool_call, info 카운트 / 에러율 / 활성 시간 / 최근 이벤트 (확장 가능) |

### 3.8 SessionNextSteps (`SessionNextSteps.tsx`) — 다음 단계 제안

| Props | `sessionId: string` |
|-------|---------------------|
| API | `GET /api/resources/sessions/{sessionId}/context` |
| 기능 | 다음 작업 제안 카드 표시 |

### 3.9 SessionChatbotView (`SessionChatbotView.tsx`) — 채팅 뷰

| Props | `sessionId: string` |
|-------|---------------------|
| 기능 | 터미널 출력을 채팅 형식으로 표시, 메시지 이력 로드, 압축 페이로드 처리 (pako), ANSI 코드 제거, 대기 승인 표시, 메시지 영속화 |

### 3.10 SessionComposerDock (`SessionComposerDock.tsx`) — 입력 독

| Props | `sessionId`, `onFocusChange?`, `focusSignal?` |
|-------|------------------------------------------------|
| 모드 | `"prompt"` \| `"question"` \| `"approval"` \| `"todo"` |
| 기능 | 명령어 입력, 질문/컨텍스트 입력, TODO 관리, 승인/거부 버튼 |

---

## 4. 그래프 구성요소 (src/components/graph/)

### 4.1 SkillGraph (`SkillGraph.tsx`) — React Flow 스킬 그래프

| 항목 | 내용 |
|------|------|
| Props | `projectId: string` |
| 역할 | 스킬 노드/엣지를 React Flow로 시각화·편집 |

**주요 상태:**
| 상태 | 설명 |
|------|------|
| `skillNodes` / `skillEdges` | API에서 가져온 원본 데이터 |
| `nodes` / `edges` | React Flow 형식 변환 |
| `loading` / `readOnly` | 로딩 및 읽기 전용 상태 |

**핵심 기능:**
- `/api/skills?projectId={id}`에서 그래프 데이터 fetch
- 드래그 앤 드롭으로 엣지 연결
- 노드 위치 자동 저장 (디바운스)
- LiveTrace를 통한 실시간 트레이스 업데이트
- 엣지 삭제

**Hooks:** `useNodesState`, `useEdgesState`, `useReactFlow`

**자식 컴포넌트:** `SkillNode`, `GraphToolbar`, `LiveTrace`, `ConnectionPanel`

---

### 4.2 SkillNode (`SkillNode.tsx`) — 커스텀 React Flow 노드

| 데이터 | `SkillNodeInfo` (id, name, nodeType, mcpEndpoint, status) |
|--------|----------------------------------------------------------|

**시각 요소:**
| 요소 | 설명 |
|------|------|
| 상태 점 | idle (회색) / running (파란 펄스) / success (녹색) / error (빨간) |
| 타입 뱃지 | default / tool / mcp / agent |
| 이름 | 스킬 이름 |
| MCP 엔드포인트 | 있을 경우 표시 |
| 핸들 | 입력(좌) / 출력(우) |
| 효과 | 상태별 색상, 글로우 이펙트 |

---

### 4.3 GraphToolbar (`GraphToolbar.tsx`) — 그래프 도구 모음

| Props | `projectId`, `nodes`, `readOnly`, `onSkillCreated`, `onSavePositions` |
|-------|-----------------------------------------------------------------------|

**기능:**
- 줌 인/아웃, 화면에 맞추기
- 노드 추가 폼 (name, nodeType, mcpEndpoint)
- 노드 검색/포커스
- `POST /api/skills`로 저장

### 4.4 LiveTrace (`LiveTrace.tsx`) — 헤드리스 트레이스 수신기

| Props | `onTraceUpdate(skillId, status)` |
|-------|----------------------------------|
| 역할 | Socket.io `skill-trace` 이벤트 수신 → 노드 상태 업데이트 |
| 동작 | 5초 미활동 시 idle로 자동 리셋, 언마운트 시 타이머 정리 |

### 4.5 ConnectionPanel (`ConnectionPanel.tsx`) — 엣지 목록 패널

| Props | `edges`, `nodes`, `onDeleteEdge(id)`, `readOnly?` |
|-------|-----------------------------------------------------|
| 기능 | 접이식 사이드 패널, source→target 연결 표시, 레이블 표시, 삭제 버튼 |

---

## 5. 모바일 구성요소 (src/components/mobile/)

### 5.1 MobileLayout (`MobileLayout.tsx`)

| Props | `children: ReactNode` |
|-------|------------------------|
| 역할 | 모바일 감지 시 flexbox 뷰포트 래퍼 적용 |
| Hook | `useMobile()` |

### 5.2 VirtualKeyboard (`VirtualKeyboard.tsx`)

| Props | `onKey(data: string)`, `visible: boolean` |
|-------|-------------------------------------------|
| 상태 | `ctrlActive`, `altActive` (모디파이어 토글) |

**키 배열:**
| 영역 | 키 |
|------|-----|
| 기능키 | Esc, Tab, Ctrl, Alt |
| 방향키 | ↑ ↓ ← → |
| 일반키 | 자주 사용하는 키 |
| 조합 | Ctrl+key → ASCII 제어 문자, Alt+key → ESC 프리픽스 |

---

## 6. 파일 구성요소 (src/components/files/)

### 6.1 CodeEditor (`CodeEditor.tsx`) — CodeMirror 래퍼

| Props | 타입 | 설명 |
|-------|------|------|
| `value` | `string` | 편집 내용 |
| `onChange` | `(value) => void` | 변경 콜백 |
| `languageId` | `LanguageId` | 구문 강조 언어 |
| `readOnly` | `boolean?` | 읽기 전용 |
| `height` | `string?` | 높이 |

**지원 언어:** js, ts, tsx, json, markdown, python, css, html

**유틸리티:** `languageFromPath(filePath) → LanguageId`

### 6.2 ProjectFilesPanel (`ProjectFilesPanel.tsx`) — 멀티페인 파일 에디터

| Props | 타입 | 설명 |
|-------|------|------|
| `projectId` | `string` | 프로젝트 ID |
| `initialOpenPath` | `string?` | 초기 열 파일 |
| `initialDirectoryPath` | `string?` | 초기 디렉토리 |
| `focusedFileOnly` | `boolean?` | 단일 파일 포커스 모드 |
| `onCloseFocusedFile` | `() => void` | 포커스 파일 닫기 |

**기능:** MultiTerminal과 유사한 페인 레이아웃, 디렉토리 Lazy-load, 파일별 구문 강조, 저장/더티 상태 관리

---

## 7. 커스텀 훅 (src/lib/hooks/)

### 7.1 useSocket

```typescript
function useSocket(): { socket: OrbitSocket | null; connected: boolean }
```
- 글로벌 Socket.io 싱글턴 초기화
- connect/disconnect 이벤트 수신

### 7.2 usePendingApprovals

```typescript
function usePendingApprovals(): {
  pendingApprovals: PendingApproval[];
  approve: (id: string) => void;
  deny: (id: string) => void;
  latestApproval: PendingApproval | null;
}
```
- `interceptor-pending` / `interceptor-resolved` 수신
- `interceptor-approve` / `interceptor-deny` emit

### 7.3 useSessionMetrics

```typescript
function useSessionMetrics(sessionId: string | null): SessionMetricsSnapshot | null
```
- `metrics-subscribe` 구독
- `session-metrics` / `session-event` 수신
- 언마운트 시 자동 구독 해제

### 7.4 useMobile

```typescript
function useMobile(): { isMobile: boolean; isTablet: boolean }
```
- `<768px` = mobile, `768–1023px` = tablet, `≥1024px` = desktop
- `matchMedia`로 반응형 업데이트

---

## 8. 유틸리티 (src/lib/)

### 8.1 socketClient.ts

| 함수 | 설명 |
|------|------|
| `getSocket(): OrbitSocket` | 글로벌 싱글턴 소켓 (자동 재연결, 인증 콜백) |
| `createTerminalSocket(): OrbitSocket` | 페인별 독립 소켓 생성 |

### 8.2 paneTree.ts — 페인 트리 순수 함수

| 함수 | 설명 |
|------|------|
| `createLeaf(sessionId)` | 새 빈 페인 생성 |
| `splitPane(root, paneId, direction, newSessionId)` | 페인 분할 |
| `closePane(root, paneId)` | 페인 제거 |
| `updateLeafSession(root, paneId, sessionId)` | 페인의 세션 변경 |
| `findLeaf(root, paneId)` | 리프 노드 검색 |
| `collectLeafIds(root)` | 모든 리프 ID 수집 |

**타입:** `PaneLeaf`, `PaneSplit`, `PaneNode` — 불변(immutable) 업데이트

### 8.3 constants.ts — 상수 정의

| 카테고리 | 상수 | 기본값 |
|----------|------|--------|
| PTY | `DEFAULT_COLS` / `DEFAULT_ROWS` | 80 / 24 |
| GC | `GC_INTERVAL_MS` / `GC_IDLE_MS` | 1h / 24h |
| SSH | `SSH_CONNECT_TIMEOUT_MS` | — |
| 그래프 | `SKILL_NODE_WIDTH/HEIGHT` / `GRAPH_AUTOSAVE_DEBOUNCE_MS` | — |
| 인터셉터 | `INTERCEPTOR_AUTO_DENY_MS` / `DEFAULT_INTERCEPTOR_MODE` | 30s |
| 파일 | `PROJECT_FILES_MAX_ENTRIES` / `MAX_READ_BYTES` / `MAX_EDIT_BYTES` | — |

### 8.4 shellQuote.ts

```typescript
function shellQuote(value: string): string  // 싱글 쿼트 래핑 + 이스케이프
```

### 8.5 prisma.ts
- PrismaClient 싱글턴 export

---

## 9. 핵심 데이터 타입 (src/lib/types.ts)

### 9.1 SessionInfo
```typescript
interface SessionInfo {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  name: string;
  agentType: string;
  sessionRef: string;
  status: "active" | "paused" | "terminated";
  lastContext: string;
  createdAt: string;
  updatedAt: string;
  source: string;
}
```

### 9.2 ProjectInfo
```typescript
interface ProjectInfo {
  id: string;
  name: string;
  type: "LOCAL" | "SSH" | "DOCKER";
  color: string;
  path: string;
  sshConfigId?: string;
  dockerContainer?: string;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### 9.3 WorkspaceLayoutInfo
```typescript
interface WorkspaceLayoutInfo {
  id: string;
  projectId: string;
  name: string;
  tree: string;       // JSON 직렬화된 PaneNode
  activePaneId: string;
  createdAt: string;
  updatedAt: string;
}
```

### 9.4 PendingApproval
```typescript
interface PendingApproval {
  id: string;
  sessionId: string;
  command: string;
  matchedRule: InterceptorRuleInfo;
  timestamp: string;
}
```

### 9.5 GraphState / SkillNodeInfo / SkillTrace
```typescript
interface GraphState {
  projectId: string;
  nodes: SkillNodeInfo[];
  edges: SkillEdgeInfo[];
  readOnly: boolean;
  source: string;
}

interface SkillNodeInfo {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  mcpEndpoint?: string;
  config?: string;
  posX: number;
  posY: number;
  nodeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 10. Socket.io 이벤트 맵

### Server → Client
| 이벤트 | 페이로드 | 소비자 |
|--------|----------|--------|
| `terminal-data` | `string` | TerminalView |
| `terminal-data-compressed` | `Buffer` | TerminalView |
| `session-update` | `SessionInfo` | Dashboard |
| `session-list` | `SessionInfo[]` | Dashboard |
| `session-exit` | `sessionId, exitCode` | TerminalView |
| `session-ready` | `sessionId` | TerminalView |
| `ssh-status` | `SshConnectionStatus` | AddSshProjectForm |
| `graph-state` | `GraphState` | SkillGraph |
| `skill-trace` | `SkillTrace` | LiveTrace |
| `interceptor-pending` | `PendingApproval` | usePendingApprovals |
| `interceptor-resolved` | `approvalId, approved` | usePendingApprovals |
| `interceptor-warn` | `InterceptorWarning` | InterceptorBanner |
| `interceptor-mode-changed` | `mode` | TerminalPane |
| `session-mode-changed` | `sessionId, mode` | TerminalPane |
| `session-event` | `SessionEvent` | useSessionMetrics |
| `session-metrics` | `SessionMetricsSnapshot` | useSessionMetrics |

### Client → Server
| 이벤트 | 페이로드 | 발신자 |
|--------|----------|--------|
| `dashboard-join` | — | Dashboard |
| `terminal-data` | `data` | TerminalView |
| `terminal-resize` | `{cols, rows}` | TerminalView |
| `session-attach` | `sessionId, callback` | TerminalView |
| `session-detach` | — | TerminalView |
| `session-list` | `projectId, callback` | Dashboard |
| `ssh-connect` | `configId, callback` | AddSshProjectForm |
| `ssh-disconnect` | `configId` | AddSshProjectForm |
| `graph-subscribe` | `projectId, callback` | SkillGraph |
| `interceptor-approve` | `approvalId` | usePendingApprovals |
| `interceptor-deny` | `approvalId` | usePendingApprovals |
| `set-interceptor-mode` | `mode, callback` | TerminalPane |
| `set-session-mode` | `sessionId, mode, callback` | TerminalPane |
| `metrics-subscribe` | `sessionId, callback` | useSessionMetrics |

---

## 11. 컴포넌트 의존성 트리

```
App (/)
└── Dashboard
    ├── ProjectList
    │   ├── DirectoryPicker
    │   └── RemoteDirectoryPicker
    ├── SessionList
    ├── SidebarFileTree
    ├── BorderlessWorkspace
    │   ├── MultiTerminal
    │   │   └── PaneRenderer (재귀)
    │   │       ├── TerminalPane
    │   │       │   └── TerminalView ← xterm.js
    │   │       └── SplitDivider
    │   ├── FileEditor
    │   ├── ProjectFilesPanel
    │   │   └── CodeEditor ← CodeMirror
    │   └── ProjectHarnessPanel
    ├── AddProjectForm → DirectoryPicker
    ├── AddSshProjectForm → RemoteDirectoryPicker
    ├── AddDockerProjectForm
    ├── InterceptorBanner
    └── InterceptorModal

/sessions/[id]
└── TerminalPage
    ├── MultiTerminal → PaneRenderer → TerminalPane → TerminalView
    ├── SessionMetricsPanel ← useSessionMetrics
    ├── SessionNextSteps
    ├── SessionChatbotView
    └── SessionComposerDock

/graph
└── SkillGraph ← React Flow
    ├── SkillNode (커스텀 노드)
    ├── GraphToolbar
    ├── LiveTrace (헤드리스)
    └── ConnectionPanel

/compare
└── ABCompare
    ├── TerminalView (좌)
    └── TerminalView (우)

/login
└── LoginPageContent
```

---

## 12. 스타일링 체계

| 항목 | 값 |
|------|-----|
| 프레임워크 | Tailwind CSS 3.4 |
| 테마 | 다크 (neutral/slate gray) |
| 좌측 패널 액센트 | 시안 (cyan) |
| 우측 패널 액센트 | 마젠타 (magenta) |
| 인터셉터 경고 | 옐로우 (yellow) |
| 터미널 배경 | `#0b1220` (다크 블루) |
| 커서 | 시안 컬러 |
| 반응형 | `sm:`, `md:`, `lg:` 브레이크포인트 |
| 모바일 안전 영역 | `safe-area-inset-bottom` (노치 기기) |

---

## 관련 노트
- 선행: `skill_graph/decisions/2026-02-28_harness-engineering.md` (하네스 아키텍처)
- 선행: `skill_graph/decisions/2026-02-27_skill-strategy.md` (스킬 전략)
- 후속: 백엔드 상세명세서 (작성 예정)
