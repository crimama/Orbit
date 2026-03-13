# 세션 채팅 낙관적 입력 + 스켈레톤 로딩 — 2026-03-13

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: session, chat-ui, optimistic-ui, skeleton-screen, mobile

---

## 증상

세션 채팅 입력에서 전송 요청이 끝날 때까지 기존 텍스트가 남아 있어 다음 입력 시작이 늦어졌고,
초기 로딩 동안에는 메시지 영역이 비어 보여 로딩 상태를 인지하기 어려웠다.

## 원인

`SessionComposerDock`는 성공 응답 이후에만 입력값을 비우는 구조였고,
채팅 뷰들은 이미 가지고 있던 `loaded` 상태를 초기 스켈레톤 렌더링에 사용하지 않았다.

## 수정

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/components/terminal/SessionComposerDock.tsx` | 전송 직후 입력을 비우고 실패 시 에러와 함께 텍스트 복원 |
| `src/components/terminal/SessionChatbotView.tsx` | `loaded === false` 동안 3줄 펄싱 스켈레톤 표시 |
| `src/components/terminal/MobileChatTerminal.tsx` | 모바일 채팅 뷰에 동일한 3줄 펄싱 스켈레톤 표시 |

### 수정 내용
```diff
- setPrompt("");
+ const nextPrompt = prompt.trim();
+ setPrompt("");
...
- if (messages.length === 0) { ... }
+ {!loaded && <LoadingSkeleton />}
+ {loaded && messages.length === 0 && ...}
```

## 검증

- [x] `SessionComposerDock`의 실패 복구 경로가 제출 텍스트를 textarea로 되돌리는지 코드 경로 확인
- [x] `SessionChatbotView`, `MobileChatTerminal`에서 `animate-pulse` / `bg-neutral-800` 스켈레톤 렌더링 확인
- [x] `npx tsc --noEmit` 실행
- [ ] 실제 브라우저 수동 확인

---

## 관련 노트
- `../decisions/2026-03-13_mobile-chat-terminal-ux-research.md`
- `../bugfix/2026-03-12_mobile-command-send-execution.md`
