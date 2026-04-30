# Tasks — Todo

## 현재 작업 (2026-04-30 Orbit macOS Electron app)

- [x] 원본 Orbit을 `~/Orbit-mac`으로 복사
- [x] 복사본 baseline commit 및 rollback tag 생성
- [x] Electron mac app 설계안 작성
- [x] 평가 에이전트 설계 리뷰 및 피드백 반영
- [ ] `$team`으로 Electron mac app 구현
- [ ] 구현 결과 평가 에이전트 검토
- [ ] 필요한 수정 반영 및 검증

## 계획 (Orbit macOS Electron app)

1. `~/Orbit-mac` 복사본에서만 mac app 작업을 진행한다.
2. Electron shell이 Orbit local server, remote URL, SSH tunnel connection profile을 선택할 수 있는 구조를 설계한다.
3. 설계 문서를 평가 에이전트에 검토시키고, 피드백을 반영해 최종 설계로 고정한다.
4. OMX `$team` worker들에게 app shell, server bootstrap/package, connection profile UX, verification/docs lane을 나눠 구현시킨다.
5. 구현 후 평가 에이전트가 설계 대비 반영 여부를 검토하고, 누락/위험 항목을 leader가 수정한다.
6. 타입/린트/빌드/Electron smoke 수준의 검증 증거를 남긴다.

## 결과

- [ ] 진행 중
- [x] verification/docs lane 초기 smoke 추가 및 1차 체크포인트 검증
- [x] `npm run desktop:smoke` 현재 `3/12` 통과, 미충족 설계 항목을 구체적 gap으로 출력
- [x] `npm run desktop:typecheck` 현재 Electron dependency/types 누락으로 실패 확인
- [ ] Electron dependency/scripts, sandbox hardening, remote preload isolation, local server supervisor, profile/tunnel modules, desktop-local auth, DB bootstrap 반영 후 재검증 필요

---

## 현재 작업 (2026-04-30 project add SSH vault reuse)

- [x] 프로젝트 추가 flow의 현재 SSH vault/profile 재사용 경로 확인
- [x] Add SSH Project form에서 기존 vault 선택/경로 지정 지원
- [x] Vault panel의 New Project handoff와 일반 Add Project modal 상태 일관화
- [x] 타입/린트/빌드 검증

## 계획 (project add SSH vault reuse)

1. 기존 `/api/ssh-configs`와 `/api/projects` 계약을 확인해 재사용 가능한 backend 경로를 확정한다.
2. 프로젝트 생성 모드에서 saved vault 선택 UI를 제공하고, 선택된 vault의 host/path/docker 기본값을 폼에 반영한다.
3. 기존 vault를 선택한 경우 새 SSH config를 만들거나 재검증을 강제하지 않고 `sshConfigId`로 프로젝트를 생성한다.
4. 새 연결 생성/테스트 flow와 vault profile 편집 flow의 기존 동작은 유지한다.
5. 타입/린트/빌드 검증 후 결과를 기록한다.

## 결과

- [x] `AddSshProjectForm` 프로젝트 모드에 `SSH Vault` / `New Host` source 추가
- [x] 기존 vault 선택 시 새 SSH config 생성/재검증 없이 선택된 `sshConfigId`로 프로젝트 생성
- [x] vault 선택 시 default path/default docker container를 remote path/target 초기값으로 반영
- [x] 기존 vault 선택 상태에서도 remote directory browse와 remote Docker container 조회가 선택된 vault id를 사용
- [x] 일반 SSH 프로젝트 탭 진입 시 이전 vault edit/prefill 상태 초기화
- [x] `npx tsc --noEmit` 통과
- [x] `npm run lint` 통과
- [x] `npm run build` 통과
- [x] 기존 dev server 확인: `curl -I http://127.0.0.1:3000` -> `302 /login?next=%2F`

---

## 현재 작업 (2026-04-30 AgentRun ledger review fixes team execution)

- [x] 개발 전 rollback tag 생성
- [x] `$team` launch context snapshot 작성
- [x] OMX team 런타임 시작 및 worker ACK/status 확인
- [x] 조치사항 병렬 구현: ledger 동시성, IO capture policy, API validation, dashboard refresh
- [x] 구현 완료 후 평가 에이전트로 review findings 반영 여부 확인
- [x] 타입/린트/schema/build 및 concurrency 검증

## 계획 (AgentRun ledger review fixes team execution)

1. 현재 HEAD를 rollback 가능한 tag로 고정한다.
2. code-review findings와 파일별 ownership을 `.omx/context/` snapshot으로 공유한다.
3. `omx team` worker들에게 겹치지 않는 lane을 배정해 병렬 진행한다.
4. worker 결과를 통합하고 충돌/누락 조치사항을 leader가 정리한다.
5. 별도 평가 에이전트로 HIGH/MEDIUM/LOW finding 반영 여부를 검증한다.
6. `npx tsc --noEmit`, `npm run lint`, `npx prisma validate`, 가능한 build/concurrency smoke로 완료 증거를 남긴다.

## 결과

- [x] rollback 기준점 고정: `rollback/pre-agent-ledger-review-fixes-20260429T161320Z`
- [x] OMX team `agentrun-ledger-review-fixes-s` 시작, worker 4개 ACK/claim 확인
- [x] Lane A: `AgentRunLedger` session-run 생성 race와 event append race 보강
- [x] Lane B: terminal input/output raw payload default persistence 제거, env gate/cap/redaction/buffering 추가
- [x] Lane C: AgentRun API body/query/id/event type runtime validation 추가
- [x] Lane D: AgentRunsPanel bounded polling과 stale error/selection 정리
- [x] 평가 에이전트 1차 FAIL 항목(concurrent append, create API edge)을 leader follow-up fix로 보완
- [x] `npx tsc --noEmit` 통과
- [x] `npm run lint` 통과
- [x] `npx prisma validate` 통과
- [x] `npm run build` 통과
- [x] 임시 SQLite DB 50-way `appendEvent` concurrency smoke 통과: `fulfilled=50`, `rejected=0`, `count=50`, `contiguous=true`
- [x] create API edge smoke 통과: `runRef: null`, blank `runRef`, blank `sessionId` 모두 400 반환

---

## 현재 작업 (2026-04-29 Warp-inspired agent ledger team execution)

- [x] 개발 전 rollback tag 생성
- [x] tracked dirty snapshot stash 생성
- [x] `$team` launch context snapshot 작성
- [x] OMX team 런타임 시작 및 worker ACK 확인
- [x] P0/P1 구현 범위 확정 후 팀 개발 진행
- [x] 타입/빌드/관련 테스트 검증

## 계획 (Warp-inspired agent ledger team execution)

1. 현재 dirty worktree를 보존하면서 rollback 가능한 기준점을 남긴다.
2. team pre-context intake 문서를 작성해 worker들이 동일한 설계/제약으로 시작하게 한다.
3. `omx team` 런타임을 시작하고 상태/ACK/mailbox 증거를 확인한다.
4. 첫 개발 slice는 `AgentRun` ledger와 durable event cursor/replay core를 우선하고, UI는 얇은 management surface로 제한한다.
5. 변경 후 `npx tsc --noEmit`, 가능한 빌드/테스트, schema/API 경로 검증을 수행한다.

## 결과

- [x] rollback 기준점 고정: `rollback/pre-team-warp-agent-ledger-20260429T061410Z`, `rollback/pre-team-warp-agent-ledger-source-20260429T061410Z`, tracked stash snapshot 생성
- [x] durable `AgentRun` / `AgentRunEvent` Prisma ledger 추가
- [x] `/api/agent-runs`, `/api/agent-runs/[id]`, `/api/agent-runs/[id]/events` 읽기/관리 API 추가
- [x] session/socket lifecycle에서 `run-created`, `session-ready`, `terminal-input`, `terminal-output`, `session-exit` event 기록
- [x] dashboard에 최근 AgentRun과 replay event cursor를 확인하는 얇은 read surface 추가
- [x] 범위를 벗어난 terminal 내부 실험 패널은 제거하고 dashboard read surface만 유지
- [x] `npx tsc --noEmit` 통과
- [x] `npm run lint` 통과
- [x] `npx prisma validate` 통과
- [x] `DATABASE_URL=file:/tmp/orbit-agent-run-ledger-final.db npm run build` 통과

---

## 현재 작업 (2026-04-29 workspace tab color simplification)

- [x] 탭의 좌측/하단 edge와 타입 아이콘 제거
- [x] 프로젝트별 컬러를 탭 배경 tint로만 표현
- [x] 타입 검증

## 계획 (workspace tab color simplification)

1. `BorderlessWorkspace` tab UI에서 kind별 visible icon과 bottom/left edge 스타일을 제거한다.
2. 프로젝트 컬러는 active/inactive 상태별 배경 tint로 적용한다.
3. `npx tsc --noEmit`로 정적 검증한다.

## 결과

- [x] 프로젝트 색상은 탭 배경 tint로만 표시
- [x] session/file/files/harness/browser visible 타입 배지 제거
- [x] 색상 edge/dot 스타일 제거, 타입 라벨은 hover title에만 유지
- [x] `npx tsc --noEmit` 통과

---

## 현재 작업 (2026-04-29 workspace tab identity)

- [x] 프로젝트 구분을 dot 외 edge/accent로 확장
- [x] 세션/파일/브라우저/하네스 tab 유형을 아이콘과 edge 톤으로 구분
- [x] 라이브 서버를 종료하지 않고 타입 검증

## 계획 (workspace tab identity)

1. `WorkspaceTab.kind`별 아이콘/색상 메타 helper를 추가한다.
2. 프로젝트 색은 tab 왼쪽 edge와 active top edge에 적용한다.
3. tab kind는 작은 아이콘과 하단 edge 색으로 구분한다.
4. `npx tsc --noEmit`로 정적 검증한다.

## 결과

- [x] `tab.kind`별 아이콘/label/bottom-edge 색상 helper 추가
- [x] 프로젝트 색을 tab left edge와 active top inset accent로 적용
- [x] tab type을 `session`, `file`, `files`, `harness`, `browser` 별 시각 신호로 분리
- [x] `npx tsc --noEmit` 통과

---

## 현재 작업 (2026-04-29 markdown default preview + workspace tab sizing)

- [x] 마크다운 파일 open 기본 모드를 preview로 변경
- [x] workspace 상단 tab 크기/가독성 확대
- [x] 라이브 서버를 종료하지 않고 타입 검증만 수행

## 계획 (markdown default preview + workspace tab sizing)

1. `FileEditor`의 markdown 초기/파일 변경 시 editor mode를 `preview`로 설정한다.
2. `BorderlessWorkspace` tab bar의 라벨, 탭 padding, font size, close hit area를 조금 키운다.
3. 실행 중인 서버는 건드리지 않고 `npx tsc --noEmit`로 정적 검증한다.

## 결과

- [x] markdown 파일 초기 open 및 파일 변경 시 기본 `editorMode`를 `preview`로 설정
- [x] workspace tab bar 높이, tab padding, 글자 크기, project label weight, close hit area 확대
- [x] 실행 중인 서버를 건드리지 않고 `npx tsc --noEmit` 통과

---

## 현재 작업 (2026-04-28 Orbit multi workspace split)

- [x] 2패널 고정 workspace split 상태 모델을 n패널 모델로 확장
- [x] 탭 drag/drop으로 3개 이상 좌우/상하 split 생성 지원
- [x] 기존 세션/브라우저 탭 mount 보존과 파일 에디터 동작 비회귀 확인
- [x] 타입/빌드 검증 및 결과 기록
- [x] n-way panel 배열을 nested split tree로 재구성
- [x] leaf panel 닫기 시 sibling 승격 UX 구현
- [x] code-review 지적사항 수정: terminal 중복 mount, sizing, split move semantics, tab class

## 계획 (Orbit multi workspace split)

1. `BorderlessWorkspace`의 `left/right` 전용 상태를 panel 배열 기반 상태로 바꾼다.
2. 현재 split 방향을 유지하면서 드래그 중 추가 drop zone을 표시하고, drop 시 새 패널을 append한다.
3. 패널별 active tab, browser keep-mounted 목록, 닫기/unsplit 동작을 panel id 기준으로 정리한다.
4. `npx tsc --noEmit`와 `npm run build`로 회귀를 확인한다.
5. nested split 요구에 맞춰 leaf panel을 임의 방향으로 다시 split할 수 있는 tree layout으로 확장한다.
6. 패널 닫기는 전체 collapse가 아니라 해당 leaf 제거 후 sibling subtree를 승격하도록 바꾼다.
7. 리뷰 결과에 따라 terminal session은 panel active tab만 mount하고, drag source panel은 split/move 후 active tab을 정리한다.

## 결과

- [x] `BorderlessWorkspace`를 `left/right` 고정 상태에서 `panels[]` 기반 상태로 전환
- [x] drag 중 단일 패널에서는 좌우/상하 split 선택 zone을 표시하고, split 상태에서는 현재 방향 끝에 새 panel append zone 표시
- [x] 3개 이상 column/row split 지원 및 divider resize를 인접 panel size 조정 방식으로 확장
- [x] panel별 active tab과 browser keep-mounted 목록을 panel id 기준으로 관리
- [x] `npx tsc --noEmit` 통과
- [x] `npm run build` 통과
- [x] `WorkspaceLayoutNode` tree 모델로 전환해 leaf panel마다 독립적으로 right/bottom split 가능
- [x] split node별 `direction`과 `ratio`를 보관해 좌우 안의 상하, 상하 안의 좌우 조합 지원
- [x] 각 leaf panel 내부 drag overlay에서 `Right` / `Bottom` drop zone 제공
- [x] nested split divider resize와 double-click reset 지원
- [x] nested split tree 기준 `npx tsc --noEmit` 통과
- [x] nested split tree 기준 `npm run build` 통과
- [x] 패널 닫기 버튼을 “현재 패널만 남기기”에서 “현재 leaf 닫고 sibling 승격”으로 변경
- [x] leaf panel close 기준 `npx tsc --noEmit` 통과
- [x] leaf panel close 기준 `npm run build` 통과
- [x] terminal session tab은 각 panel의 active session 하나만 mount하도록 수정해 hidden 중복 `MultiTerminal` 제거
- [x] split drop 시 drag source panel의 active tab을 fallback/null로 정리해 동일 tab visible duplicate 방지
- [x] nested split leaf/root wrapper에 `h-full w-full overflow-hidden` 계약을 명시해 file/editor clipping 완화
- [x] tab title class 조합의 `ml-1text-neutral-500` invalid class 수정
- [x] `/api/filesystem`을 dynamic route로 명시해 build-time filesystem page-data 수집 실패 방지
- [x] code-review fix 기준 `npm run build` 통과
- [x] code-review fix 기준 `npx tsc --noEmit` 통과

---

## 현재 작업 (2026-04-28 Orbit markdown editor + split UX)

- [x] 워크스페이스 탭 상하 split 방향 반영
- [x] 최근 본 파일 바로가기 저장/표시/재오픈 구현
- [x] 마크다운 에디터 Edit/Preview/Split 모드와 자동 저장 구현
- [x] 타입/빌드 검증 및 결과 기록

## 계획 (Orbit markdown editor + split UX)

1. 기존 dashboard/file/terminal split 상태를 보존하면서 워크스페이스 탭 drop direction 버그를 최소 수정한다.
2. 파일 오픈 경로에 recent-file localStorage 갱신을 붙이고 Files 사이드바에 compact shortcut을 추가한다.
3. 단일 `FileEditor`에 markdown split preview와 debounce autosave를 추가하되 충돌 시 자동 덮어쓰지 않는다.
4. `npx tsc --noEmit` 및 가능한 빌드 검증을 실행하고 잔여 리스크를 정리한다.

## 결과

- [x] 워크스페이스 탭 drop 시 오른쪽은 좌우 split, 아래쪽은 상하 split direction을 실제 레이아웃에 반영
- [x] 파일 오픈 시 최근 파일 localStorage shortcut 저장 및 Files 사이드바 Recent 섹션에서 재오픈 지원
- [x] 마크다운 단일 파일 에디터에 Edit/Split/Preview 모드 추가
- [x] 마크다운 변경 debounce 자동 저장 추가, mtime 충돌 시 자동 덮어쓰기 대신 Conflict + Reload 표시
- [x] `/api/interceptor/rules`를 runtime dynamic route로 명시해 build-time Prisma page-data 수집 실패 수정
- [x] `npx tsc --noEmit` 통과
- [x] `npm run build` 통과

## 현재 작업 (2026-04-17 simplified mobile mode QA hands-on app execution)

- [x] Playwright 기반 모바일/데스크탑 스모크 및 시나리오 실행
- [x] `/m` 수동 브라우저 확인으로 잔여 모바일 플로우 보강
- [x] `npx tsc --noEmit` / `npm run build` 게이트 재검증
- [x] QA verdict / coverage / blocker 정리

## 계획 (simplified mobile mode QA hands-on app execution)

1. 개발 서버를 띄우고 기존 Playwright suite로 `/m` 및 `/` 핵심 시나리오를 먼저 실행한다.
2. 자동화 결과를 바탕으로 부족한 모바일 UX 흐름은 브라우저 수동 점검으로 보완한다.
3. 타입체크와 프로덕션 빌드를 다시 실행해 릴리즈 게이트를 확인한다.
4. 최종적으로 시나리오별 통과 여부, 신뢰도, 차단 이슈를 정리한다.

## 결과

- [x] `src/app/m/page.tsx` + `src/components/mobile/MobileModeScreen.tsx`로 전용 모바일 경로 `/m` 추가
- [x] 모바일 프로젝트 선택 / Start / Re-enter / Stop 컨트롤 구현
- [x] `MobileChatTerminal` attach retry/backoff 및 attach error 표면화 추가
- [x] Playwright `mobile-chromium` 프로젝트와 `tests/e2e/mobile-mode.spec.ts` 추가
- [x] 모바일 E2E 9개 시나리오(route shell, desktop smoke, start/stop, duplicate stop, chat flow, re-enter, start failure, reconnect, happy path) 통과
- [x] `npm run build` 통과
- [x] `npx tsc --noEmit` 통과

## 현재 작업 (2026-04-17 simplified mobile mode)

- [ ] `/m` 전용 모바일 경로와 구현 seam 확정
- [ ] 모바일 Start/Stop/Re-enter lifecycle 계약 고정
- [ ] 모바일 UX spec/Playwright harness/세션 제어/채팅 경로 구현
- [ ] 모바일 reconnect/error 상태와 데스크탑 비회귀 자동 검증

## 계획 (simplified mobile mode)

1. Wave 1: 모바일 route seam, lifecycle contract, UX spec을 먼저 확정한다.
2. Wave 2: `/m` route shell, Playwright mobile harness, project/session control을 구현한다.
3. Wave 3: chatbot-only mobile conversation, reconnect/error hardening, 최종 E2E/build/type gates를 통과시킨다.

## 결과

- [x] `tests/e2e/mobile-mode.spec.ts` 실행: 18개 중 17개 즉시 통과, `mobile-chromium @mobile-happy` 1건은 프로젝트 card 대기 timeout 발생
- [x] 동일 `@mobile-happy` 시나리오를 `--project=mobile-chromium --workers=1`로 재실행 시 통과 → 앱 기능보다는 suite 간 test-data cleanup 간섭 가능성 확인
- [x] 실제 브라우저 스크립트로 `/m` route shell → Start → chat send → Stop → `/` desktop dashboard 흐름 재검증 통과
- [x] `npm run build` 통과 (pre-existing ESLint warning 2건 유지: `src/components/dashboard/SidebarFileTree.tsx` hook deps)
- [x] `npx tsc --noEmit` 통과

## 현재 작업 (2026-04-17 browser refresh + remote access design)

- [x] 브라우저 탭 전환 시 refresh처럼 보이는 현재 구조와 원인 후보를 설계 관점에서 정리
- [x] SSH 로컬 포트포워딩 의존 없이 원격 접속 가능한 내장 접근 방식 옵션 정리
- [x] 구현 전 설계안/단계별 적용 전략 문서화

## 계획 (browser refresh + remote access design)

1. 브라우저 lifecycle, socket/session persistence, PWA 관련 경로를 찾아 현재 동작을 구조적으로 정리한다.
2. 현재 원격 접근 방식(127.0.0.1 기본, remote/tailscale 옵션, 인증 경계)을 확인하고 대체 가능한 내장 접근 모델을 비교한다.
3. 코드 변경 없이 우선 적용 가능한 설계안, 리스크, 추천 순서를 제안한다.

## 결과

- [x] `BorderlessWorkspace`에서 session 탭은 mounted 유지, non-session 탭(`browser`, `files`, `harness`)은 active일 때만 렌더링됨을 확인
- [x] browser 탭을 panel별 keep-mounted 캐시로 전환해 iframe remount 없이 visibility만 토글되도록 수정
- [x] `Dashboard`가 선택 프로젝트/inline session 상태를 durable하게 저장하지 않아 background 후 홈으로 초기화되는 원인을 확인
- [x] `Dashboard`에 localStorage 기반 resume snapshot을 추가해 초기 fetch 뒤 현재 프로젝트/세션 컨텍스트를 복원하도록 수정
- [x] resume hydration 중 홈 화면이 먼저 그려져 Home → Session처럼 보이는 UX 원인을 확인
- [x] `resumeReady` 전에는 restoring placeholder를 렌더링해 홈 flash 없이 세션 복원으로 이어지도록 수정
- [x] Next custom server가 서버 전용 tsconfig를 실제 사용하지 않고 있었고 `tsconfig.server.json`도 invalid module/moduleResolution 조합이었던 원인을 확인
- [x] `package.json` dev/start 스크립트를 `tsx --tsconfig tsconfig.server.json` 경로로 수정하고 dev watch 인자 순서를 바로잡음
- [x] `tsconfig.server.json`에 `moduleResolution: node`를 추가해 server runtime 해석 경로를 안정화
- [x] `npm run dev` smoke test에서 custom server 정상 부팅 확인
- [x] `usePageVisibility` + `useSocket`가 5분 이상 백그라운드 시 소켓 transport를 끊고 복귀 시 재연결하는 구조임을 확인
- [x] `server.ts`에서 기본 loopback-only, `ORBIT_ALLOW_REMOTE`, `ORBIT_REMOTE_SCOPE=tailscale`, `ORBIT_ACCESS_TOKEN` 기반 원격 접근 경계를 확인
- [x] `scripts/run-tailscale.sh`가 tailnet 전용 내장 원격 접근 진입점 역할을 이미 수행함을 확인
- [x] `npx tsc --noEmit` 통과
- [x] `npm run build` 통과

## 현재 작업 (2026-04-02 md 파일 패널 evaluator review)

- [x] md 파일 패널 핫픽스 정적 리뷰 수행
- [x] 타입/린트/빌드 게이트 재검증
- [x] evaluator 리포트 작성

## 계획 (md 파일 패널 evaluator review)

1. 변경된 파일 뷰/프리뷰/업로드 경로를 기준으로 코드 리뷰를 수행한다.
2. `npx tsc --noEmit`, `npm run lint`, `npm run build` 신호를 모아 게이트 상태를 확인한다.
3. `.claude/evals/`에 팀 evaluator와 master evaluator 리포트를 남긴다.

## 결과

- [x] code review 결과 blocking finding 없음
- [x] `npx tsc --noEmit` 통과
- [x] `npm run lint` 통과
- [x] `npm run build` 통과
- [x] team evaluator 리포트 작성: `.claude/evals/md-file-panel-team-evaluator-2026-04-02.md`
- [x] master evaluator 리포트 작성: `.claude/evals/md-file-panel-master-evaluator-2026-04-02.md`

---

## 현재 작업 (2026-04-02 md 파일 패널 핫픽스)

- [x] 마크다운 프리뷰가 저장 직후 열린 상태에서 즉시 반영되지 않는 원인 수정
- [x] 같은 파일 재오픈이 막히는 파일 패널 상태 전이 수정
- [x] 좌측 파일 사이드바에서 파일 업로드 진입점 추가
- [x] 관련 타입/서버/API 연결 검증

## 계획 (md 파일 패널 핫픽스)

1. 파일 패널/에디터에서 열린 문서 상태와 프리뷰 렌더 타이밍을 점검해 stale state 경로를 제거한다.
2. 파일 탭/패널 close 후 동일 파일 재오픈이 막히는 선택 상태를 정리한다.
3. 기존 업로드 API가 있으면 좌측 사이드바에 연결하고, 없으면 최소 API와 UI를 추가한다.
4. `npx tsc --noEmit` 및 필요한 빌드/동작 경로를 검증한다.

## 결과

- [x] `FileEditor`에 마크다운 프리뷰 자동 동기화 추가 (`read` API poll + `mtime` 추적)
- [x] 동일 파일 재오픈 가능하도록 `viewedFile` 요청 토큰 기반 갱신으로 수정
- [x] 좌측 파일 사이드바에 `Upload` 버튼과 빈 영역 컨텍스트 메뉴 업로드 항목 추가
- [x] 새 API route `src/app/api/projects/[id]/files/upload/route.ts` 추가
- [x] `npx tsc --noEmit` 통과
- [x] `npm run build` 통과

---

## 완료된 작업

- [x] 모바일 UI `type command` send 시 터미널 포커스만 이동하고 실행되지 않는 문제 수정
- [x] Phase 1: 인프라 구축
- [x] 프로젝트 별 하네스 엔지니어링 관리 + oh-my-opencode 특화 + 세션 UI/UX 개선
- [x] YOLO 모드 버그 수정 + 세션별 YOLO 구현
- [x] Technical Audit 32건 수정 (10 Critical + 20 High + 2 Medium) — SHIP

---

## 현재 작업 (2026-03-27 takeover)

- [x] Sprint 1 병렬 워크트리 변경 통합 (team-a/ team-b/ team-c)
- [x] Team Evaluator 점검: Sprint 1 항목별 목적 부합 여부 + 누락 검증
- [x] 통합 브랜치에서 타입/빌드 검증
- [x] Master Evaluator 최종 점검: Sprint 1 exit criteria 충족 여부(조건부 PASS)

## 계획 (팀/평가자 운영 모델)

1. Team A (mobile-core): `1-1`, `1-3`, `1-7`
   - source: `.claude/worktrees/agent-af0ad8d9`
   - 대상: `src/components/terminal/TerminalPane.tsx`, `src/app/layout.tsx`
2. Team B (feedback-and-safety): `1-4`, `1-5`, `1-6`
   - source: `.claude/worktrees/agent-a923ce42`
   - 대상: `src/components/dashboard/Dashboard.tsx`, `src/components/ui/*`, `src/hooks/*`, `src/app/layout.tsx`
3. Team C (theme-token): `1-2`
   - source: `.claude/worktrees/agent-aa298746`
   - 대상: `tailwind.config.ts`, `src/lib/theme.ts`, 주요 화면 토큰 적용 파일
4. Team Evaluator 루프 (각 팀 변경마다 반복)
   - 요구사항 매핑: `tasks/todo.md` Sprint 1 항목, `.claude/evals/user-persona-scenario.md`
   - 코드 점검: dead code 제거 여부, 접근성/피드백 반영 여부
   - 검증 게이트: `npx tsc --noEmit`, `npm run build`
5. Master Evaluator (Sprint 1 통합 후)
   - Sprint 1 검증 기준 8개 체크
   - FAIL/PARTIAL 시나리오 개선 반영 확인

## 결과

- [x] Team evaluator 리포트 작성: `.claude/evals/sprint1-team-evaluator-2026-03-27.md`
- [x] Master evaluator 리포트 작성: `.claude/evals/sprint1-master-evaluator-2026-03-27.md`
- [x] `npx tsc --noEmit` 통과
- [x] `npm run build` 통과 (pre-existing warning 2건 유지)
- [ ] 모바일 실기기 수동 QA: VirtualKeyboard/Chat Toggle/P2-S3 시나리오

---

## 현재 작업 (2026-03-27 issue hotfix round)

- [x] Team A (session-visibility): 프로젝트 선택 시 `projectId` 기반 세션 병합 보장
- [x] Team B (terminal-width): attach 직후 fit/resize 보장으로 반폭 렌더링 제거
- [x] Team C (session-ref-hardening): Claude sessionRef 캡처 재시도로 매핑 안정화
- [x] Team Evaluator: 코드 경로/회귀 리스크 점검
- [x] Master Evaluator: 타입/빌드 게이트 통과 및 잔여 수동 QA 항목 명시 (조건부 PASS)

## 계획 (이슈 핫픽스 라운드)

1. `Dashboard`의 세션 fetch 경로를 프로젝트 선택 컨텍스트에 맞게 정규화
2. `TerminalView`에서 session-attach 성공 직후 `fit + terminal-resize` 1회 보장
3. `SessionManager.captureClaudeSessionRef`를 재시도(backoff) 방식으로 강화
4. 평가자 문서(`.claude/evals/`)에 팀별 판단 근거와 잔여 QA 항목 기록
5. `npx tsc --noEmit`, `npm run build` 실행

## 결과 (issue hotfix round)

- [x] Team evaluator 리포트 작성: `.claude/evals/issue-hotfix-team-evaluator-2026-03-27.md`
- [x] Master evaluator 리포트 작성: `.claude/evals/issue-hotfix-master-evaluator-2026-03-27.md`
- [x] `npx tsc --noEmit` 통과
- [x] `npm run build` 통과 (pre-existing warning 2건 유지)
- [ ] 수동 QA: 프로젝트 전환 시 세션 merge 검증 + single-pane `stty size` 확인

---

## 개발 계획: 페르소나-시나리오 기반 UX 개선 (v2 — 2026-03-27 revised)

> **근거**: `.claude/evals/user-persona-scenario.md` (21 시나리오 중 2 PASS / 10 PARTIAL / 9 FAIL)
> **목표**: pass@3 > 70% (현재 10%), v1.0 전 모든 FAIL 해소
> **예상 총 기간**: 24-32일 (버퍼 포함)

### 의존성 체인 (Critical Path)

```
Sprint 1-2(테마 토큰) ──→ Sprint 1-4(토스트) ──→ Sprint 2-9(에러 메시지)
Sprint 2-1(빈 대시보드) ──→ Sprint 5-1(설정 페이지) ──→ Sprint 6-1(온보딩 위자드)
Sprint 3a-2(단축키 시스템) ──→ Sprint 3a-3(단축키 오버레이) ──→ Sprint 3b-3(커맨드 팔레트 확장)
Sprint 1-1(VirtualKeyboard) ──→ Sprint 3a-1(모바일 탭바)
```

---

### Sprint 1: v0.2 — Dead Code 연결 + UX 기반 (예상 3-4일)

> **테마**: 이미 만들어놓고 연결 안 된 것들 살리기 + 디자인 시스템 기반 + 최소 UX 안전장치

| #   | 작업                                            | 이슈         | 심각도   | 영향 페르소나 |
| --- | ----------------------------------------------- | ------------ | -------- | ------------- |
| 1-1 | VirtualKeyboard를 TerminalPane에 연결           | MOB-1, MOB-5 | CRITICAL | P2            |
| 1-2 | **다크/라이트 테마 통일 + 디자인 토큰 정의**    | UX-1, UX-2   | HIGH     | 전체          |
| 1-3 | MobileChatTerminal을 라우팅에 연결              | MOB-2        | CRITICAL | P2            |
| 1-4 | 글로벌 토스트/알림 시스템 구축 (테마 토큰 사용) | MF-3, UX-8   | HIGH     | 전체          |
| 1-5 | 삭제/종료 확인 대화상자 추가                    | MF-4, UX-10  | HIGH     | 전체          |
| 1-6 | 하네스 탭 활성화 (`{false && ...}` 제거)        | DC-3         | HIGH     | P4            |
| 1-7 | 핀치 줌 차단 해제 (접근성)                      | UX-14        | HIGH     | P2            |

**순서 근거**: 1-2(테마)를 1-1 다음으로 이동 — 1-4(토스트), 1-5(확인 대화상자)가 테마 토큰에 의존

**검증 기준**:

- [ ] 모바일에서 VirtualKeyboard로 Ctrl+C, Esc, 방향키 입력 가능
- [ ] MobileChatTerminal이 모바일 세션 라우트에서 렌더링됨
- [ ] 대시보드↔세션 간 테마 일관성 (동일 디자인 토큰)
- [ ] 버튼 스타일이 전역적으로 통일 (UX-2 해소)
- [ ] 하네스 탭이 대시보드에서 접근 가능
- [ ] 프로젝트 삭제/세션 종료 시 확인 대화상자 표시
- [ ] 토스트 알림이 성공/실패 액션에 표시
- [ ] `npx tsc --noEmit` && `npm run build` 통과

---

### Sprint 2: v0.3 — 온보딩 & 네비게이션 (예상 4-5일)

> **테마**: 신규 사용자(P1)가 막힘 없이 첫 세션까지 도달 + 도움말 시스템

| #   | 작업                                             | 이슈        | 심각도 | 영향 페르소나 |
| --- | ------------------------------------------------ | ----------- | ------ | ------------- |
| 2-1 | 빈 대시보드 정보 아키텍처 재구성 + 브레드크럼    | P1-S5, UX-5 | HIGH   | P1            |
| 2-2 | 글로벌 네비게이션 바                             | UX-6        | HIGH   | 전체          |
| 2-3 | 에이전트 유형 설명 tooltip/모달                  | P1-S3       | MEDIUM | P1            |
| 2-4 | YOLO 버튼 위험 경고 tooltip                      | P1-S3       | MEDIUM | P1,P5         |
| 2-5 | 연결 상태 인디케이터 (전역)                      | MF-7        | HIGH   | P2,P3         |
| 2-6 | **도움말 페이지 + 키보드 단축키 안내**           | P1-S4       | HIGH   | P1,P4         |
| 2-7 | **브라우저 뒤로가기 SPA 히스토리 정합성**        | UX-4        | HIGH   | 전체          |
| 2-8 | 로딩 상태 일관성 통일 (스켈레톤 표준화)          | UX-7        | MEDIUM | 전체          |
| 2-9 | 에러 메시지 사용자 친화적으로 개선 (토스트 활용) | UX-9        | MEDIUM | 전체          |

**변경사항 (v1 대비)**:

- `2-1`에 브레드크럼(UX-5) 통합 — 빈 대시보드 재구성과 네비게이션은 같은 맥락
- `2-6` 추가: P1-S4(도움말 FAIL) 해소 — `/help` 라우트 + 단축키 가이드
- `2-7` 추가: UX-4(뒤로가기) — SPA 히스토리 관리, 세션 전환 시 URL 반영
- `connect_error` 개선(구 2-7)은 Technical Audit에서 이미 수정됨 → 제거

**검증 기준**:

- [ ] 프로젝트 0개 상태에서 "프로젝트 만들기" CTA가 화면 중앙에 표시
- [ ] 고급 패널(비용, SSH Vault, 감사 로그)이 프로젝트 없을 때 숨겨짐
- [ ] 현재 위치(프로젝트→세션→터미널) 브레드크럼 표시
- [ ] 글로벌 네비바에서 주요 페이지 접근 가능
- [ ] `/help` 페이지에서 기능 안내 + 단축키 목록 확인 가능
- [ ] 브라우저 뒤로가기가 예측 가능하게 동작
- [ ] 소켓 연결/해제/재연결 상태가 전역 인디케이터로 표시
- [ ] `npx tsc --noEmit` && `npm run build` 통과

---

### Sprint 3a: v0.4a — 모바일 + 키보드 (예상 3-4일)

> **테마**: 모바일 동등 제어 + 키보드 생산성

| #    | 작업                                             | 이슈         | 심각도 | 영향 페르소나 |
| ---- | ------------------------------------------------ | ------------ | ------ | ------------- |
| 3a-1 | 모바일 전용 네비게이션 (하단 탭바 + 스와이프)    | MF-6, MOB-4  | HIGH   | P2            |
| 3a-2 | 글로벌 키보드 단축키 체계                        | MF-14, P4-S5 | HIGH   | P4            |
| 3a-3 | 키보드 단축키 도움말 오버레이 (`?` 키)           | P1-S4        | MEDIUM | P1,P4         |
| 3a-4 | 모바일 Long-press 컨텍스트 메뉴                  | MOB-3        | MEDIUM | P2            |
| 3a-5 | 네트워크 불안정 시 재연결 진행바 + 오프라인 표시 | P2-S4        | MEDIUM | P2            |

**검증 기준**:

- [ ] 모바일에서 하단 탭바로 대시보드/터미널/설정 전환
- [ ] 세션 간 스와이프 네비게이션 동작
- [ ] `?` 키로 단축키 오버레이 표시
- [ ] `Ctrl+N` 새 세션, `Ctrl+Tab` 세션 전환 동작
- [ ] 모바일에서 터미널 long-press → 컨텍스트 메뉴 (복사/붙여넣기)
- [ ] 소켓 재연결 시 진행바 표시, 오프라인 시 배너 표시

---

### Sprint 3b: v0.4b — 파워유저 + 보안 UI (예상 3-4일)

> **테마**: 멀티서버 모니터링 + 보안 관리 UI

| #    | 작업                                      | 이슈  | 심각도 | 영향 페르소나 |
| ---- | ----------------------------------------- | ----- | ------ | ------------- |
| 3b-1 | 멀티 세션 그리드 뷰 (2x2, 3x2)            | MF-11 | HIGH   | P3            |
| 3b-2 | A/B 비교 UI 진입점 (대시보드 버튼)        | MF-16 | MEDIUM | P4            |
| 3b-3 | 커맨드 팔레트 액션 확장                   | MF-15 | MEDIUM | P4            |
| 3b-4 | 인터셉터 규칙 관리 UI                     | MF-18 | HIGH   | P5            |
| 3b-5 | 감사 로그 필터 강화 + 내보내기 (CSV/JSON) | MF-19 | MEDIUM | P5            |
| 3b-6 | 프로젝트별 비용 분류                      | MF-12 | MEDIUM | P3            |
| 3b-7 | 비용 추세 차트                            | MF-13 | MEDIUM | P3            |

**검증 기준**:

- [ ] 2x2 그리드 뷰에서 4개 세션 동시 모니터링
- [ ] 대시보드에서 "Compare" 버튼으로 비교 페이지 진입
- [ ] 커맨드 팔레트에서 "새 세션 생성" 등 액션 실행 가능
- [ ] 인터셉터 규칙을 UI에서 추가/수정/삭제/테스트 가능
- [ ] 감사 로그를 날짜/이벤트/세션으로 필터링 + CSV 내보내기
- [ ] 비용 대시보드에 프로젝트별 분류 + 추세 차트 표시

---

### Sprint 4: v0.5 — 기술 부채 + 성능 (예상 3-4일)

> **테마**: Technical Audit 잔여 MEDIUM/LOW 수정 + 성능 최적화
> **근거**: Eval 검토에서 24건의 미처리 기술 부채 발견

| #   | 작업                                               | 이슈  | 심각도 | 카테고리 |
| --- | -------------------------------------------------- | ----- | ------ | -------- |
| 4-1 | 테스트 인프라 구축 (Jest/Vitest + 기본 테스트)     | B-2   | MEDIUM | 인프라   |
| 4-2 | SSH host/port 검증 (SSRF 방지)                     | A-11  | MEDIUM | 보안     |
| 4-3 | 소켓 이벤트별 인가 검증                            | A-12  | MEDIUM | 보안     |
| 4-4 | SSH 세션 폴링 최적화 (3초→이벤트 기반)             | S-5   | MEDIUM | 성능     |
| 4-5 | 중복 세션 폴링 제거 (TerminalPage + MultiTerminal) | F-14  | MEDIUM | 성능     |
| 4-6 | Resize 핸들러 디바운스                             | T-10  | MEDIUM | 성능     |
| 4-7 | `buildGlobalFileIndex` 디바운스                    | F-17  | LOW    | 성능     |
| 4-8 | 서버 연결 히스토리 로그                            | P3-S4 | MEDIUM | P3       |
| 4-9 | 색상 대비 WCAG AA 준수                             | UX-13 | LOW    | 접근성   |

**검증 기준**:

- [ ] `npm test` 동작 + 최소 핵심 모듈 테스트 존재
- [ ] SSH config에 host/port 유효성 검증 적용
- [ ] 소켓 이벤트 핸들러에 세션 소유권 검증 적용
- [ ] 세션 폴링이 중복 없이 단일 소스로 통합
- [ ] `npx tsc --noEmit` && `npm run build` 통과

---

### Sprint 5: v0.6 — 통합 & 정리 (예상 3-4일)

> **테마**: 분산된 설정 통합 + SSH 폼 리팩토링 + 접근성

| #   | 작업                                           | 이슈         | 심각도 | 영향 페르소나 |
| --- | ---------------------------------------------- | ------------ | ------ | ------------- |
| 5-1 | 통합 설정 페이지 (`/settings`)                 | MF-2         | HIGH   | P1,P4,P5      |
| 5-2 | SSH 폼 단계별 위자드로 리팩토링 (974줄→3단계)  | P1-S5        | HIGH   | P1,P3         |
| 5-3 | 서버 상태 대시보드 (green/yellow/red)          | MF-10        | MEDIUM | P3            |
| 5-4 | 3+ 분할 터미널                                 | MF-17        | LOW    | P4            |
| 5-5 | 포커스 관리 + ARIA 레이블                      | UX-11, UX-12 | MEDIUM | 전체          |
| 5-6 | 비밀번호 설정 UX 개선 (강도 표시, 성공 피드백) | P1-S1        | LOW    | P1            |

**검증 기준**:

- [ ] `/settings` 경로에서 SSH, 인터셉터, MCP, 테마 등 통합 관리
- [ ] SSH 프로젝트 등록이 3단계 위자드 (기본→고급→확인)
- [ ] 서버 연결 상태가 green/yellow/red 인디케이터로 표시
- [ ] Tab 키로 주요 UI 요소 순회 가능
- [ ] 모달 열림/닫힘 시 포커스 트랩 동작

---

### Sprint 6: v1.0 — 완성도 (예상 5-7일)

> **테마**: 온보딩 완성 + 오프라인 + 고급 기능
> **의존**: Sprint 2-1(빈 대시보드) → Sprint 5-1(설정 페이지) → Sprint 6-1(온보딩 위자드)

| #   | 작업                                                   | 이슈      | 영향 페르소나 |
| --- | ------------------------------------------------------ | --------- | ------------- |
| 6-1 | 온보딩 위자드 (3단계: 프로젝트 등록→첫 세션→기본 조작) | MF-1      | P1            |
| 6-2 | Service Worker + 오프라인 캐시                         | MF-9      | P2            |
| 6-3 | 배치 세션 작업 (일괄 종료/재시작)                      | MF-21     | P3,P4         |
| 6-4 | 세션 그룹/태그                                         | MF-22     | P3            |
| 6-5 | 프로젝트별 권한 정책                                   | MF-20     | P5            |
| 6-6 | 체크포인트 리플레이 UI                                 | MF-25     | P4            |
| 6-7 | 비용 한도 알림 + CSV 내보내기                          | MF-3 확장 | P3            |
| 6-8 | PWA 아이콘/설치 유도 배너                              | P2-S1     | P2            |

**검증 기준**:

- [ ] 첫 접속 시 온보딩 위자드가 프로젝트 등록까지 안내
- [ ] 오프라인 상태에서 대시보드 캐시된 데이터 표시
- [ ] 다수 세션 체크박스 선택 → 일괄 종료 가능
- [ ] 21개 시나리오 중 15개 이상 PASS (70%+)

---

## 커버리지 매트릭스

### 시나리오별 해소 Sprint

| 시나리오              | 현재       | Sprint         | 목표 |
| --------------------- | ---------- | -------------- | ---- |
| P1-S1 최초 접속       | ✅ PASS    | 5-6 보강       | PASS |
| P1-S2 첫 프로젝트     | ⚠️ PARTIAL | 2-1            | PASS |
| P1-S3 첫 세션         | ⚠️ PARTIAL | 1-6, 2-3, 2-4  | PASS |
| P1-S4 도움말          | ❌ FAIL    | **2-6**, 3a-3  | PASS |
| P1-S5 빈 대시보드     | ❌ FAIL    | 2-1            | PASS |
| P2-S1 PWA 설치        | ⚠️ PARTIAL | 6-2, 6-8       | PASS |
| P2-S2 모바일 대시보드 | ⚠️ → FAIL  | **3a-1**       | PASS |
| P2-S3 모바일 터미널   | ❌ FAIL    | **1-1**, 1-3   | PASS |
| P2-S4 불안정 네트워크 | ❌ FAIL    | **3a-5**       | PASS |
| P3-S1 SSH 등록        | ⚠️ PARTIAL | 5-2            | PASS |
| P3-S2 동시 모니터링   | ❌ FAIL    | **3b-1**       | PASS |
| P3-S3 비용 추적       | ⚠️ PARTIAL | 3b-6, 3b-7     | PASS |
| P3-S4 연결 문제       | ❌ FAIL    | **4-8**, 5-3   | PASS |
| P4-S1 A/B 비교        | ⚠️ PARTIAL | 3b-2           | PASS |
| P4-S2 커맨드 팔레트   | ✅ PASS    | 3b-3 보강      | PASS |
| P4-S3 멀티 터미널     | ⚠️ PARTIAL | 5-4            | PASS |
| P4-S4 하네스/MCP      | ⚠️ PARTIAL | 1-6, 5-1       | PASS |
| P4-S5 단축키          | ❌ FAIL    | **3a-2**, 3a-3 | PASS |
| P5-S1 인터셉터        | ⚠️ PARTIAL | **3b-4**       | PASS |
| P5-S2 감사 로그       | ⚠️ PARTIAL | 3b-5           | PASS |
| P5-S3 권한 관리       | ❌ FAIL    | **6-5**        | PASS |

### UX/MOB 이슈 커버리지

| 이슈                     | Sprint   | 비고                   |
| ------------------------ | -------- | ---------------------- |
| UX-1 테마 불일치         | 1-2      | 디자인 토큰 포함       |
| UX-2 버튼 스타일         | 1-2      | 테마 통일에 포함       |
| UX-3 폰트 불일치         | 1-2      | 테마 토큰으로 해소     |
| UX-4 뒤로가기            | **2-7**  | SPA 히스토리           |
| UX-5 브레드크럼          | 2-1      | 대시보드 재구성에 포함 |
| UX-6 글로벌 네비바       | 2-2      |                        |
| UX-7 로딩 일관성         | 2-8      |                        |
| UX-8 성공 토스트         | 1-4      |                        |
| UX-9 에러 메시지         | 2-9      |                        |
| UX-10 확인 대화상자      | 1-5      |                        |
| UX-11 ARIA               | 5-5      |                        |
| UX-12 포커스 관리        | 5-5      |                        |
| UX-13 색상 대비          | 4-9      |                        |
| UX-14 핀치 줌            | 1-7      |                        |
| MOB-1 VirtualKeyboard    | 1-1      |                        |
| MOB-2 MobileChatTerminal | 1-3      |                        |
| MOB-3 Long-press         | **3a-4** |                        |
| MOB-4 스와이프           | **3a-1** |                        |
| MOB-5 특수키 입력        | 1-1      |                        |

---

## 구현 원칙

1. **디자인 토큰 먼저**: Sprint 1-2에서 테마 + 디자인 토큰을 정리하면 이후 모든 UI 작업이 일관됨
2. **토스트 시스템 먼저**: Sprint 1-4에서 글로벌 알림을 구축하면 이후 모든 기능에서 재사용
3. **점진적 디스클로저**: 빈 대시보드→프로젝트 있는 대시보드→파워유저 대시보드 순으로 복잡도 노출
4. **모바일 = 데스크탑**: OUTLINE.md 불변 제약 #5 준수, 모바일 기능은 별도 Sprint가 아니라 매 Sprint에 포함
5. **기술 부채 20% 룰**: Sprint 4를 기술 부채 전용으로 배치, 이후 Sprint에서도 20% 할당
6. **의존성 체인 준수**: `테마→토스트→에러메시지`, `빈 대시보드→설정 페이지→온보딩 위자드` 순서 위반 금지

## Sprint 로드맵 요약

| Sprint   | 버전  | 테마                         | 항목 수 | 예상 기간   |
| -------- | ----- | ---------------------------- | ------- | ----------- |
| 1        | v0.2  | Dead Code + 디자인 기반      | 7       | 3-4일       |
| 2        | v0.3  | 온보딩 + 네비게이션 + 도움말 | 9       | 4-5일       |
| 3a       | v0.4a | 모바일 + 키보드              | 5       | 3-4일       |
| 3b       | v0.4b | 파워유저 + 보안 UI           | 7       | 3-4일       |
| 4        | v0.5  | **기술 부채 + 성능**         | 9       | 3-4일       |
| 5        | v0.6  | 통합 + 정리                  | 6       | 3-4일       |
| 6        | v1.0  | 완성도                       | 8       | 5-7일       |
| **합계** |       |                              | **51**  | **24-32일** |

## 이전 세션 (2026-03-12)

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
