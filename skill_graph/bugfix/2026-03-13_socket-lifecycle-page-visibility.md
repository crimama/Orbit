# Socket lifecycle + page visibility — 2026-03-13

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: socket, visibility, background, reconnect, session

---

## 증상

브라우저 탭이 장시간 백그라운드에 있어도 공용 Socket.io 클라이언트가 계속 연결을 유지했다.
이 때문에 불필요한 연결이 남고, 복귀 시점을 명시적으로 제어할 수 없었다.

## 원인

`src/lib/useSocket.ts`는 mount 시점에만 singleton 소켓을 연결하고, 페이지 가시성 상태를 전혀 반영하지 않았다.
짧은 탭 전환과 장기 백그라운드가 같은 상태로 취급되어 lifecycle 제어 지점이 없었다.

## 수정

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/lib/hooks/usePageVisibility.ts` | 30초 백그라운드 기준 `backgrounded` 상태를 제공하는 공용 훅 추가 |
| `src/lib/useSocket.ts` | 가시성 훅을 통합해 장기 백그라운드 시 `disconnect()`, 복귀 시 `connect()` 수행 |

### 수정 내용
```diff
+ const { backgrounded } = usePageVisibility();
+
+ if (backgrounded) {
+   socket.disconnect();
+   setConnected(false);
+   return;
+ }
+
+ if (!socket.connected) {
+   socket.connect();
+ }
```

## 검증

- [x] 30초 이상 백그라운드 시에만 `backgrounded`가 `true`로 전환되도록 코드 경로 확인
- [x] 복귀 시 `useSocket` effect가 즉시 `socket.connect()`를 호출하도록 확인
- [x] `npx tsc --noEmit` 실행
- [ ] 브라우저에서 30초 대기 포함 실사용 수동 검증

---

## 관련 노트
- `../features/2026-02-27_phase1-infra.md`
- `../decisions/2026-03-13_mobile-chat-terminal-ux-research.md`
