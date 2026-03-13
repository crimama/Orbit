# 모바일 command send 미실행 — 2026-03-12

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: mobile, terminal, session, command, pty

---

## 증상

모바일 UI의 `Type command...` 입력창에서 텍스트를 입력하고 `Send`를 누르면,
명령이 실행되기보다 터미널 pane 활성화만 일어나는 것처럼 보였고 PTY에서 실제 실행이 안정적으로 일어나지 않았다.

## 원인

모바일 chat terminal만 명령 전송을 `socket.emit("terminal-data", value + "\\r")` 경로에 직접 의존하고 있었다.
이 경로는 해당 소켓의 attach 상태와 터치 시점에 민감했고, 데스크톱/다른 채팅형 입력 UI가 사용하는 서버 측 `sessionManager.sendInput()` 경로와도 분리되어 있었다.

## 수정

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/components/terminal/MobileChatTerminal.tsx` | 모바일 `Send`를 `/api/sessions/[id]/command` 경유로 통일하고 전송 상태/에러 표시 추가 |

### 수정 내용
```diff
- socket.emit("terminal-data", value + "\r");
+ await fetch(`/api/sessions/${sessionId}/command`, {
+   method: "POST",
+   headers: { "Content-Type": "application/json" },
+   body: JSON.stringify({ input: value, appendNewline: true }),
+ });
```

## 검증

- [x] 모바일 입력/전송 경로와 기존 `/command` API 경로 비교 확인
- [x] `npx tsc --noEmit` 실행
- [ ] 실제 모바일 브라우저 수동 재현 확인

---

## 관련 노트
- `../features/2026-02-28_phase2-4-parallel.md`
- `../decisions/2026-03-12_happy-mobile-yolo-research.md`
