# Browser tab refresh persistence — 2026-04-17

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: browser tab, iframe, workspace, remount, persistence

---

## 증상

워크스페이스 안에서 browser 탭을 열고 다른 탭으로 이동했다가 돌아오면 iframe이 다시 생성되면서 페이지가 새로고침되었다.

## 원인

`src/components/dashboard/BorderlessWorkspace.tsx`는 session 탭만 항상 mounted 상태로 유지하고, non-session 탭은 active일 때만 렌더링했다.
browser 탭도 이 경로를 사용하고 있었기 때문에 탭 전환 시 iframe이 unmount/remount되어 상태가 유지되지 않았다.

## 수정

### 변경 파일

| 파일                                               | 변경 내용                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/dashboard/BorderlessWorkspace.tsx` | panel별 browser 탭 캐시를 추가해 한 번 열린 iframe은 탭 전환 후에도 mounted 상태를 유지하도록 수정 |

### 수정 내용

```diff
+ const [mountedBrowserTabs, setMountedBrowserTabs] = useState({ left: [], right: [] });
+
+ // panel별로 한 번 열린 browser 탭을 기억
+ rememberBrowserTab("left", leftTabId);
+ rememberBrowserTab("right", rightTabId);
+
+ // browser 탭은 panel 내부에서 visibility만 전환
+ {browserTabs.map((tab) => (
+   <div style={{ visibility: activeTabId === tab.id ? "visible" : "hidden" }}>
+     {renderNonSessionTab(tab)}
+   </div>
+ ))}
```

## 검증

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [ ] 브라우저에서 browser 탭 전환 후 iframe 상태 유지 수동 확인
- [ ] 회귀 테스트 추가

---

## 관련 노트

- `../bugfix/2026-03-13_socket-lifecycle-page-visibility.md`
