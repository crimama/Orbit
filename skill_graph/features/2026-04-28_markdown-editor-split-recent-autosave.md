# Markdown Editor Split, Recent Files, Autosave

## 요약

Orbit dashboard의 파일 편집 흐름을 개선했다.

- 워크스페이스 탭 drag/drop split에서 bottom drop이 실제 상하 split을 만들도록 direction state를 연결했다.
- 워크스페이스 split 모델을 `left/right` 2패널 고정에서 nested split tree로 확장해 각 패널을 다시 좌우/상하로 쪼갤 수 있게 했다.
- nested split leaf panel 닫기 시 전체 layout을 접지 않고 sibling subtree를 승격시킨다.
- terminal session tab은 hidden 중복 mount하지 않고 각 panel의 active session tab만 mount한다.
- split drop은 drag source panel의 active tab을 fallback/null로 정리해 동일 tab이 두 panel에서 동시에 active가 되는 것을 방지한다.
- nested split leaf/root wrapper에 full-size layout 계약을 명시해 file/editor clipping을 줄였다.
- workspace tab은 프로젝트 색상을 배경 tint로만 표현하고, 좌/하단 edge와 visible 타입 아이콘은 쓰지 않는다.
- 파일 오픈 시 프로젝트별 최근 파일 shortcut을 `localStorage`에 저장하고 Files 사이드바에서 재오픈할 수 있게 했다.
- 단일 파일 `FileEditor`의 markdown 기본 모드를 preview로 바꾸고 Edit/Split/Preview 전환을 추가했다.
- markdown 변경은 900ms debounce로 자동 저장한다.
- 저장 충돌은 자동 덮어쓰기하지 않고 `Conflict` 상태와 `Reload` 액션으로 표면화한다.

## 주요 파일

- `src/components/dashboard/BorderlessWorkspace.tsx`
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/SidebarFileTree.tsx`
- `src/components/dashboard/FileEditor.tsx`
- `src/app/api/interceptor/rules/route.ts`

## 결정

- 최근 파일은 서버 DB에 추가하지 않고 브라우저-local UX 상태로 둔다.
- 자동 저장은 우선 markdown 파일에만 적용한다.
- 저장 속도 개선은 API 변경보다 UI debounce/coalescing으로 먼저 해결한다.
- mtime 충돌 시 자동 저장은 멈추고 사용자가 reload를 선택하게 한다.
- nested split은 leaf panel 단위 drop overlay로 생성한다. 각 split node가 `direction`과 `ratio`를 보관해 좌우 안의 상하, 상하 안의 좌우 조합을 표현한다.
- panel close는 split tree에서 leaf를 제거하고 같은 부모의 sibling을 승격한다. active panel을 닫으면 승격된 subtree의 첫 panel로 focus를 이동한다.
- terminal tab은 socket, PTY attach, resize side effect를 가진 stateful workspace이므로 browser iframe처럼 hidden keep-mounted하지 않는다.
- 탭의 프로젝트 구분은 dot/edge/icon을 섞지 않고 프로젝트 컬러 기반 배경 tint 하나로 제한한다. 탭 유형은 visible badge 대신 hover title에만 남겨 시각 혼잡을 줄인다.

## 검증

- `npx tsc --noEmit`
- `npm run build`
- 개발 서버 `http://127.0.0.1:3001/login` HTTP 200 확인

## 키워드

`markdown` `autosave` `recent-files` `workspace-split` `multi-split` `nested-split` `workspace-tab` `tab-color` `file-view` `dashboard`
