# Per-Project File Manager + Viewer/Editor (LOCAL + SSH)

## TL;DR

> **Summary**: 프로젝트별로 안전한(root sandbox) 파일 트리/CRUD + 파일 viewer/editor(CodeMirror 6)를 Dashboard에 추가한다.
> **Deliverables**:
>
> - Project-scoped 파일 API: browse/read/write/mkdir/create/rename/delete (LOCAL+SSH)
> - SSH 파일 작업은 `ssh2` SFTP 기반으로 구현
> - Dashboard “Files” 탭: 파일 트리 + 탭 기반 에디터 + CRUD 액션
> - 보안 가드레일: traversal/symlink escape 차단, 크기 제한, 충돌(mtime) 방지
>   **Effort**: Medium
>   **Parallel**: YES - 3 waves
>   **Critical Path**: API contract + sandbox → LOCAL backend → SSH(SFTP) backend → UI integration

## Context

### Original Request

- "각 프로젝트 별 파일 관리 및 파일 viewer&editor 기능" 추가.

### Interview Summary

- Scope: Full file management (CRUD)
- Project types: LOCAL + SSH (DOCKER 제외)
- Editor: CodeMirror 6

### Metis Review (gaps addressed)

- API는 project-relative path만 허용(절대경로/`..` 금지) + realpath/canonical 기반 sandbox
- symlink 정책 명시(리스트 표시 가능, 파일 열기/쓰기/삭제/rename은 기본 차단)
- 대용량/바이너리/대규모 디렉토리 DoS 방어(엔트리/바이트 제한)
- 동시 편집 overwrite 방지(expected mtime precondition + 409)
- SSH reconnect/SFTP invalidation 방지(open SFTP per request)

## Work Objectives

### Core Objective

- Dashboard에서 프로젝트 root 내 파일을 안전하게 탐색/열기/편집/저장/CRUD할 수 있게 한다(LOCAL+SSH).

### Deliverables

- API (App Router): `/api/projects/[id]/files/*`
  - list: 디렉토리 1-depth listing (files + dirs)
  - read: 파일 읽기(utf8) + 메타데이터
  - write: 저장(expectedMtimeMs precondition)
  - mkdir/create/rename/delete: CRUD
- Server utility: project path sandbox + SSH(SFTP) 구현
- UI: Project view에 Files 탭 추가(트리+탭+에디터)

### Definition of Done (verifiable)

- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` 모두 통과
- [ ] LOCAL 프로젝트에서 API CRUD가 sandbox/충돌/크기 제한 포함하여 동작(curl+jq로 검증)
- [ ] SSH 프로젝트에서 동일 API가 SFTP로 동작(docker 기반 sshd로 자동 검증)
- [ ] Dashboard에서 Files 탭으로 파일 열기/편집/저장/rename/delete/mkdir가 동작(Playwright 없이도 API 검증 + UI 최소 시나리오)

### Must Have

- Project-relative path contract (input/output)
- Sandbox: traversal + symlink escape 차단
- Size limits: list/max entries, read/write max bytes
- Conflict detection: expected mtime precondition (409)

### Must NOT Have

- DOCKER 프로젝트 지원(후속)
- API에서 절대경로 반환/수용 금지
- shell 기반(sshManager.exec)으로 원격 파일 CRUD 구현 금지

## Verification Strategy

> ZERO HUMAN INTERVENTION — verification is command-driven.

- Tests: repo에 테스트 러너 없음 → lint/typecheck/build + curl/jq smoke + docker sshd integration
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.txt`

## Execution Strategy

### Parallel Execution Waves

Wave 1 (contracts + security foundation)

- Types/API contract + sandbox utility + LOCAL list/read/write

Wave 2 (SSH backend)

- sshManager SFTP helper + SSH CRUD routes + docker sshd smoke test

Wave 3 (UI)

- Dashboard Files 탭 + FileTree + CodeMirror editor + CRUD wiring

### Dependency Matrix

- UI depends on API contract + backends (Wave 1/2)
- SSH backend depends on SFTP helper

## TODOs

> Implementation + verification in each task.

- [ ] 1. Define API Contract + Types for Project Files

  **What to do**:
  - Add new shared types in `src/lib/types.ts` (do NOT repurpose `BrowseResponse` used by directory pickers).
  - Lock API contract to project-relative paths:
    - Request/response `path` is always project-relative ("" means project root).
    - Reject absolute paths, backslashes, `..` segments.
  - Add types (names are fixed for downstream tasks):
    - `ProjectFileEntryInfo`: `name`, `path`, `isDir`, `isSymlink`, `size`, `mtimeMs`
    - `ProjectFileListResponse`: `current`, `parent`, `entries`
    - `ProjectFileReadResponse`: `path`, `content`, `isBinary`, `size`, `mtimeMs`, `encoding`
    - `ProjectFileWriteRequest`: `content`, `expectedMtimeMs?`, `create?`
    - `ProjectFileWriteResponse`: `{ ok: true; mtimeMs: number; size: number }`
    - `ProjectFileMkdirRequest`: `{ path: string }`
    - `ProjectFileRenameRequest`: `{ from: string; to: string }`
    - `ProjectFileDeleteRequest`: `{ path: string; recursive?: boolean }`
  - Add server-side limits in `src/lib/constants.ts`:
    - `PROJECT_FILES_MAX_ENTRIES=2000`
    - `PROJECT_FILES_MAX_READ_BYTES=10_000_000`
    - `PROJECT_FILES_MAX_EDIT_BYTES=2_000_000`

  **Must NOT do**:
  - Do not return OS-absolute paths in new APIs.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — cross-cutting types/constants.
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2-7 | Blocked By: -

  **References**:
  - Existing browse-only types: `src/lib/types.ts` (`DirEntry`, `BrowseResponse`)
  - API response convention: `src/app/api/projects/route.ts`

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` passes.

  **QA Scenarios**:

  ```
  Scenario: Types compile cleanly
    Tool: Bash
    Steps: npx tsc --noEmit
    Expected: exit code 0
    Evidence: .sisyphus/evidence/task-1-types-tsc.txt
  ```

  **Commit**: YES | Message: `feat(files): add shared types and limits` | Files: `src/lib/types.ts`, `src/lib/constants.ts`

- [ ] 2. Implement LOCAL Project File APIs (sandbox + CRUD)

  **What to do**:
  - Create `src/server/files/projectPathSandbox.ts` (LOCAL):
    - Only accept project-relative paths.
    - Use `realpath()` for root + targets (or parent for creates).
    - Reject outside-root.
    - `lstat()` to detect symlinks.
    - Symlink policy: allow listing, block open/write/rename/delete on symlinks.
  - Add routes:
    - `src/app/api/projects/[id]/files/list/route.ts` (GET)
    - `src/app/api/projects/[id]/files/read/route.ts` (GET)
    - `src/app/api/projects/[id]/files/write/route.ts` (PUT)
    - `src/app/api/projects/[id]/files/mkdir/route.ts` (POST)
    - `src/app/api/projects/[id]/files/rename/route.ts` (POST)
    - `src/app/api/projects/[id]/files/delete/route.ts` (POST)
  - Behavior:
    - Project type LOCAL only for this task; others return 501.
    - list: depth=1, cap entries, include files+dirs.
    - read: cap bytes, detect binary(NUL) → content null.
    - write: cap bytes, atomic temp+rename, expectedMtimeMs precondition → 409.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — security-sensitive file operations.
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5-7 | Blocked By: 1

  **References**:
  - Prisma Project lookup: `src/app/api/projects/[id]/route.ts`
  - Existing unsandboxed local browse (do NOT reuse): `src/app/api/filesystem/route.ts`

  **Acceptance Criteria**:
  - [ ] Local CRUD smoke (curl+jq) passes.
  - [ ] list/read 응답의 `path/current/parent`는 항상 project-relative(leading `/` 없음)이다.
  - [ ] stale `expectedMtimeMs`로 write 요청 시 409 conflict를 반환한다.

  **QA Scenarios**:

  ```
  Scenario: LOCAL list/read/write/rename/delete inside sandbox
    Tool: Bash
    Steps:
      1) command -v jq >/dev/null
      2) export ORBIT_ACCESS_TOKEN=testtoken PORT=3010 SSH_PASSWORD_SECRET=secret
      3) ORBIT_ACCESS_TOKEN=$ORBIT_ACCESS_TOKEN PORT=$PORT npm run dev >/tmp/orbit-dev-files.log 2>&1 & PID=$!
      3) ROOT=$(mktemp -d); mkdir -p "$ROOT/sub"; printf 'hello\n' > "$ROOT/sub/a.txt"
      4) PROJECT_ID=$(curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -d "{\"name\":\"tmp\",\"type\":\"LOCAL\",\"path\":\"$ROOT\"}" "http://127.0.0.1:$PORT/api/projects" | jq -r '.data.id')
      5) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/list?path=" | jq -e '.data.entries[] | select(.name=="sub" and .isDir==true)'
      5.1) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/list?path=" | jq -e '.data.current | startswith("/") | not'
      6) READ=$(curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/read?path=sub/a.txt")
      7) MTIME=$(printf '%s' "$READ" | jq -r '.data.mtimeMs')
      8) printf '%s' "$READ" | jq -e '.data.content=="hello\n" and .data.isBinary==false'
      9) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -X PUT -d "{\"content\":\"changed\\n\",\"expectedMtimeMs\":$MTIME}" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/write?path=sub/a.txt" | jq -e '.data.ok==true'
      9.1) curl -s -o /tmp/conflict.json -w "%{http_code}" -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -X PUT -d "{\"content\":\"changed-again\\n\",\"expectedMtimeMs\":$MTIME}" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/write?path=sub/a.txt" | grep -qx "409"
      10) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -d "{\"from\":\"sub/a.txt\",\"to\":\"sub/b.txt\"}" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/rename" | jq -e '.data.ok==true'
      11) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -d "{\"path\":\"sub/b.txt\"}" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/delete" | jq -e '.data.ok==true'
      12) kill $PID; wait $PID 2>/dev/null || true
    Expected: All jq checks succeed
    Evidence: .sisyphus/evidence/task-2-local-crud.txt

  Scenario: Traversal is blocked
    Tool: Bash
    Steps:
      1) curl -s -o /tmp/trav.json -w "%{http_code}" -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" "http://127.0.0.1:$PORT/api/projects/$PROJECT_ID/files/read?path=../etc/passwd" | grep -qx "400"
      2) jq -e '.error | contains("outside")' /tmp/trav.json
    Expected: HTTP 400 + outside error
    Evidence: .sisyphus/evidence/task-2-local-traversal.txt
  ```

  **Commit**: YES | Message: `feat(files): add local project file CRUD APIs` | Files: `src/app/api/projects/[id]/files/**`, `src/server/files/**`

- [ ] 3. Add SSH SFTP Support in sshManager (per-request SFTP)

  **What to do**:
  - Extend `src/server/ssh/sshManager.ts` with `withSftp<T>(configId, fn)`:
    - Ensure connected (connect if needed)
    - Open/close SFTP per call
    - Retry once if reconnect swapped underlying client

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 4 | Blocked By: 2

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` passes.

  **QA Scenarios**:

  ```
  Scenario: SSH SFTP helper compiles
    Tool: Bash
    Steps: npx tsc --noEmit
    Expected: exit code 0
    Evidence: .sisyphus/evidence/task-3-ssh-sftp-tsc.txt
  ```

  **Commit**: YES | Message: `feat(ssh): add per-request SFTP helper` | Files: `src/server/ssh/sshManager.ts`

- [ ] 4. Implement SSH Project File APIs (SFTP backend)

  **What to do**:
  - In the `/api/projects/[id]/files/*` routes, add SSH branch:
    - project.type === "SSH" → use `sshManager.withSftp(project.sshConfigId)`
    - sandbox: `sftp.realpath` on root/targets + prefix check
    - symlink policy via `sftp.lstat`
  - For project.type === "DOCKER": return 501.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6-7 | Blocked By: 3

  **Acceptance Criteria**:
  - [ ] docker sshd 기반 자동 smoke가 read/write/rename/delete까지 통과

  **QA Scenarios**:

  ```
  Scenario: SSH CRUD via docker sshd
    Tool: Bash
    Steps:
      1) command -v jq >/dev/null
      2) export ORBIT_ACCESS_TOKEN=testtoken PORT=3010 SSH_PASSWORD_SECRET=secret
      3) ORBIT_ACCESS_TOKEN=$ORBIT_ACCESS_TOKEN PORT=$PORT SSH_PASSWORD_SECRET=$SSH_PASSWORD_SECRET npm run dev >/tmp/orbit-dev-sshfiles.log 2>&1 & PID=$!
      3) docker rm -f orbit-sshd >/dev/null 2>&1 || true
      4) docker run -d --name orbit-sshd -p 2222:2222 linuxserver/openssh-server:latest -e PUID=1000 -e PGID=1000 -e TZ=UTC -e PASSWORD_ACCESS=true -e USER_PASSWORD=pass1234 -e USER_NAME=tester
      5) sleep 5
      6) SSHCFG=$(curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -d '{"host":"127.0.0.1","port":2222,"username":"tester","authMethod":"password","password":"pass1234"}' "http://127.0.0.1:$PORT/api/ssh-configs" | jq -r '.data.id')
      7) PROJ=$(curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -d "{\"name\":\"sshproj\",\"type\":\"SSH\",\"sshConfigId\":\"$SSHCFG\",\"path\":\"/home/tester\"}" "http://127.0.0.1:$PORT/api/projects" | jq -r '.data.id')
      8) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -X PUT -d '{"content":"hello\n"}' "http://127.0.0.1:$PORT/api/projects/$PROJ/files/write?path=test.txt" | jq -e '.data.ok==true'
      9) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" "http://127.0.0.1:$PORT/api/projects/$PROJ/files/read?path=test.txt" | jq -e '.data.content=="hello\n"'
      10) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -d '{"from":"test.txt","to":"test2.txt"}' "http://127.0.0.1:$PORT/api/projects/$PROJ/files/rename" | jq -e '.data.ok==true'
      11) curl -s -H "x-orbit-token: $ORBIT_ACCESS_TOKEN" -H "content-type: application/json" -d '{"path":"test2.txt"}' "http://127.0.0.1:$PORT/api/projects/$PROJ/files/delete" | jq -e '.data.ok==true'
      12) docker rm -f orbit-sshd >/dev/null 2>&1 || true
      13) kill $PID; wait $PID 2>/dev/null || true
    Expected: All jq checks succeed
    Evidence: .sisyphus/evidence/task-4-ssh-crud.txt
  ```

  **Commit**: YES | Message: `feat(files): support ssh projects via SFTP` | Files: `src/app/api/projects/[id]/files/**`, `src/server/ssh/sshManager.ts`

- [ ] 5. Add CodeMirror 6 Editor Dependencies + Wrapper Component

  **What to do**:
  - Add deps: `@uiw/react-codemirror` + language packages.
  - Create `src/components/files/CodeEditor.tsx` wrapper.
  - Implement language detection in UI (fixed rule):
    - `.ts/.tsx/.js/.jsx` => `javascript`
    - `.json` => `json`
    - `.md` => `markdown`
    - `.py` => `python`
    - `.css` => `css`
    - `.html` => `html`
    - otherwise => `plain`

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 6 | Blocked By: 2

  **Acceptance Criteria**:
  - [ ] `npm run build` passes.

  **QA Scenarios**:

  ```
  Scenario: Build passes with editor deps
    Tool: Bash
    Steps: npm install && npm run build
    Expected: build success
    Evidence: .sisyphus/evidence/task-5-codemirror-build.txt
  ```

  **Commit**: YES | Message: `feat(files-ui): add CodeMirror editor component` | Files: `package.json`, lockfile, `src/components/files/CodeEditor.tsx`

- [ ] 6. Build Project Files UI (tree + tabs + CRUD)

  **What to do**:
  - Create `src/components/files/ProjectFilesPanel.tsx`:
    - Lazy directory tree via list endpoint
    - Tabs + dirty indicator
    - Save with expectedMtimeMs; handle 409 conflicts
    - CRUD (create/mkdir/rename/delete) + confirm
  - Binary/too-large: read-only viewer message + download CTA.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 7 | Blocked By: 2,5

  **Acceptance Criteria**:
  - [ ] UI compiles and can open/save a small text file.

  **QA Scenarios**:

  ```
  Scenario: Local file open/save via UI (manual actions avoided)
    Tool: Bash
    Steps: npm run build
    Expected: build success (UI compiles)
    Evidence: .sisyphus/evidence/task-6-files-ui-build.txt
  ```

  **Commit**: YES | Message: `feat(files-ui): add project files panel with CRUD` | Files: `src/components/files/**`

- [ ] 7. Integrate Files Tab into Dashboard Project View

  **What to do**:
  - Update `src/components/dashboard/Dashboard.tsx`:
    - Add `Files` toggle next to Harness/Terminal controls.
    - Render `ProjectFilesPanel` when Files selected.
    - Preserve: project click opens Harness; session click opens Terminal.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: - | Blocked By: 6

  **Acceptance Criteria**:
  - [ ] Switching Files ↔ Terminal does not lose the selected inline session.

  **QA Scenarios**:

  ```
  Scenario: Build + basic API smoke after integration
    Tool: Bash
    Steps: npm run lint && npx tsc --noEmit && npm run build
    Expected: all pass
    Evidence: .sisyphus/evidence/task-7-integration-build.txt
  ```

  **Commit**: YES | Message: `feat(dashboard): add Files tab for projects` | Files: `src/components/dashboard/Dashboard.tsx`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)

- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Security/Path Sandbox Review — oracle
- [ ] F3. Code Quality Review — unspecified-high
- [ ] F4. UX/Regression Check — unspecified-high

## Commit Strategy

- Commit 1: `feat(files): add project-scoped file APIs (local+ssh)`
- Commit 2: `feat(files-ui): add dashboard files tab with editor`

## Success Criteria

- 사용자 관점: 프로젝트 선택 후 Files 탭에서 파일 CRUD + 편집 저장이 빠르고 안전하게 된다.
