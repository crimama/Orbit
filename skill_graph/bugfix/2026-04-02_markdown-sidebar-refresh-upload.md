# 마크다운 뷰어 stale 상태 + 파일 재오픈 실패 + 사이드바 업로드 부재 — 2026-04-02

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: markdown, preview, sidebar, upload, workspace, file-view

---

## 증상

- Claude 세션이 `.md` 파일을 수정해도 열린 마크다운 프리뷰가 즉시 갱신되지 않았다.
- 파일 탭을 닫은 뒤 좌측 사이드바에서 같은 파일을 다시 눌러도 열리지 않았고, 다른 파일을 한 번 연 뒤에만 다시 열 수 있었다.
- 좌측 파일 사이드바에서 직접 파일 업로드를 시작할 수 있는 UI가 없었다.

## 원인

- `BorderlessWorkspace`가 마지막으로 연 파일을 `projectId:path` 키로만 캐시하고 있어, 동일 파일 재요청을 무시했다.
- `FileEditor`는 처음 연 시점의 내용만 들고 있었고 외부 수정 감지나 재동기화 경로가 없었다.
- 서버에는 `uploadProjectFile()` 구현이 있었지만 실제 Next.js API route와 사이드바 UI가 연결되어 있지 않았다.

## 수정

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/components/dashboard/Dashboard.tsx` | 파일 열기 요청에 `requestId`, `mtimeMs`를 포함하도록 변경 |
| `src/components/dashboard/BorderlessWorkspace.tsx` | 동일 파일 재오픈을 허용하도록 요청 토큰 기준으로 파일 탭 갱신 |
| `src/components/dashboard/FileEditor.tsx` | 마크다운 프리뷰 자동 동기화와 `expectedMtimeMs` 기반 저장 추가 |
| `src/components/dashboard/SidebarFileTree.tsx` | 좌측 사이드바 업로드 버튼/컨텍스트 메뉴/파일 input 연결 |
| `src/app/api/projects/[id]/files/upload/route.ts` | multipart 업로드 API route 추가 |

### 수정 내용
```diff
- const key = `${viewedFile.projectId}:${viewedFile.path}`;
+ const key = viewedFile.requestId;

- onFileOpen(filePath, json.data.content ?? "");
+ onFileOpen(filePath, json.data.content ?? "", json.data.mtimeMs);

+ const intervalId = window.setInterval(() => {
+   void syncPreview();
+ }, 1500);

+ const res = await fetch(`/api/projects/${projectId}/files/upload`, {
+   method: "POST",
+   body: form,
+ });
```

## 검증

- [x] `npx tsc --noEmit` 실행
- [x] `npm run build` 실행
- [ ] 브라우저 수동 확인: 열린 마크다운 프리뷰 자동 반영
- [ ] 브라우저 수동 확인: 동일 파일 close → reopen
- [ ] 브라우저 수동 확인: 사이드바 업로드 후 목록/열기 동작

---

## 관련 노트
- `../features/2026-03-12_frontend-component-specification.md`
