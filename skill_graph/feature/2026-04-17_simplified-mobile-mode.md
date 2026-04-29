# Simplified mobile mode — 2026-04-17

> **상태**: 🟢 implemented
> **keywords**: mobile, /m, mobile chat, session control, playwright

---

## 목표

모바일에서 데스크탑 대시보드 복잡도를 그대로 축소하는 대신, 전용 `/m` 경로에서

- 프로젝트 선택
- 세션 Start / Re-enter / Stop
- 채팅형 상호작용

만 제공하는 단순 모바일 모드를 구현한다.

## 구현 요약

### 1. 전용 모바일 경로

- `src/app/m/page.tsx`
- `src/components/mobile/MobileModeScreen.tsx`

`/m`은 데스크탑 `Dashboard`와 분리된 모바일 전용 진입점이다.

### 2. 모바일 세션 제어

- 프로젝트 목록은 `/api/projects`
- 프로젝트별 세션 목록은 `/api/sessions?projectId=...`
- Start는 `POST /api/sessions`
- Stop은 `DELETE /api/sessions/:id`
- Re-enter는 기존 active session id를 다시 바인딩해 chat shell로 복귀

모바일은 단일 active session UX를 전제로 한다.

### 3. 채팅형 세션 화면

- `MobileChatTerminal` 재사용
- 채팅 shell은 `boundSessionId`가 존재하는 동안 유지
- active session 로딩/attach 지연 중에는 `Preparing the session…` 상태를 표시

### 4. attach 안정화

- `MobileChatTerminal`에 `session-attach` retry/backoff 추가
- attach 실패 원인을 status text로 노출
- session exit 시 상태를 명시적으로 종료로 반영

### 5. 테스트

- `playwright.config.ts`에 `mobile-chromium` 프로젝트 추가
- `tests/e2e/mobile-mode.spec.ts` 추가
- 검증 시나리오:
  - route shell
  - desktop smoke
  - start/stop
  - duplicate stop
  - chat flow
  - re-enter
  - start failure
  - reconnect
  - happy path

## 구현 중 핵심 교훈

1. 모바일 화면 상태는 `activeSession`만으로 gating하면 race가 발생한다.
   - Start 직후 `boundSessionId`는 설정되지만 `activeSession`은 아직 fetch 전일 수 있다.
   - 따라서 `/m` chat shell은 `boundSessionId`도 고려해야 한다.

2. 모바일 chat attach는 실패를 silent ignore 하면 안 된다.
   - Playwright/실기기 모두에서 attach 실패 시 retry/backoff + 오류 표면화가 필요하다.

3. 모바일 E2E cleanup은 project name prefix만으로는 불충분하다.
   - auto-generated session names가 prefix를 갖지 않을 수 있어, test project id에 속한 session까지 함께 정리해야 한다.

## 후속 고려사항

- 모바일에서 `claude-code` 세션 Start 후 실제 attach/streaming을 더 사용자 친화적으로 설명하는 copy 정리
- `/m`에 더 명시적인 empty/error illustrations 추가
- Playwright 인증 토큰 처리 방식과 artifact 정책 정리
