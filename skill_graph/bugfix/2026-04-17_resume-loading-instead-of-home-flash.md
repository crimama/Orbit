# Resume loading instead of home flash — 2026-04-17

> **심각도**: 🟡 Minor
> **상태**: 🟢 해결
> **keywords**: resume, hydration, home flash, dashboard, UX

---

## 증상

background/discard 후 Orbit으로 복귀하면 마지막 세션으로 다시 돌아가기는 했지만,
중간에 홈 화면이 잠깐 보였다가 세션 화면으로 전환되어 “세션 창이 그대로 유지되는 느낌”이 부족했다.

## 원인

이전 수정으로 resume snapshot은 복원되지만, `resumeReady`가 되기 전까지 `Dashboard`는 기본 렌더 경로상 홈 화면을 먼저 그렸다.
그래서 실제 복원은 성공해도 사용자 눈에는 `Home -> Session` 전환처럼 보였다.

## 수정

### 변경 파일

| 파일                                     | 변경 내용                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/components/dashboard/Dashboard.tsx` | resume hydration 중에는 홈/워크스페이스 대신 전용 restoring 상태를 렌더링하도록 수정 |

### 수정 내용

```diff
+ const showResumeLoading = !resumeReady;
+
+ if (showResumeLoading) {
+   return "Restoring your last workspace…";
+ }
```

## 검증

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [ ] 브라우저 tab discard/복귀 시 홈 화면 flash 없이 restoring -> session 복원 수동 확인

---

## 관련 노트

- `./2026-04-17_dashboard-resume-after-background-reload.md`
