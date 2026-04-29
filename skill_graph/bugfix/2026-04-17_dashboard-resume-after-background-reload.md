# Dashboard resume after background reload — 2026-04-17

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: dashboard, resume, background, reload, session restore, localStorage

---

## 증상

Orbit 대시보드 안에서 특정 세션을 작업 중일 때 브라우저 다른 탭이나 다른 앱으로 이동했다가 돌아오면,
세션 프로세스는 살아 있지만 UI는 홈 상태로 돌아가 현재 작업 중이던 세션이 열려 있지 않았다.

## 원인

`src/components/dashboard/Dashboard.tsx`는 현재 선택된 프로젝트, inline session, inline workspace를 모두 React state로만 관리하고 있었다.
브라우저가 탭을 discard하거나 페이지를 다시 로드하면 `/` 경로는 다시 `Dashboard`를 mount하지만,
이 상태를 복원할 durable snapshot이 없어 `selectedProject` / `inlineSessionId`가 모두 `null`로 초기화되었다.

## 수정

### 변경 파일

| 파일                                     | 변경 내용                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/dashboard/Dashboard.tsx` | 현재 대시보드 컨텍스트를 localStorage에 저장하고, 초기 프로젝트/세션 fetch 완료 후 복원하도록 수정 |

### 수정 내용

```diff
+ const DASHBOARD_RESUME_STORAGE_KEY = "orbit:dashboard-resume";
+
+ // selectedProject / inlineSessionId / inlineWorkspaceId / pane state 저장
+ writeDashboardResumeSnapshot({ ... });
+
+ // 초기 projects/sessions fetch 완료 후 snapshot 복원
+ setSelectedProject(restoredProject);
+ setInlineSessionId(sessionFromSelection?.id ?? null);
+ setInlineWorkspaceId(snapshot.inlineWorkspaceId ?? null);
```

## 검증

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [ ] 브라우저 탭 background/discard 후 복귀 시 동일 세션 복원 수동 확인
- [ ] 실제 모바일 브라우저 / 메모리 압박 환경에서 수동 확인

---

## 관련 노트

- `./2026-04-17_browser-tab-refresh-persistence.md`
- `./2026-03-13_socket-lifecycle-page-visibility.md`
