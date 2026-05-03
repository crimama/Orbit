# Packaged Local Terminal Start — 2026-05-03

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: `electron` `macOS` `packaged-local` `terminal` `node-pty` `PATH`

---

## 증상

macOS packaged local mode에서 Orbit 서버 접속은 되지만 세션 터미널이 정상적으로 열리지 않았다.

## 원인

터미널 attach 경로에서 `node-pty` spawn 실패가 발생하면 `ensureSessionRunning()`이 `false`만 반환했고, socket callback에는 일반적인 `Session not found or not running` 메시지만 전달됐다. 또한 Finder에서 실행한 packaged app은 shell 환경이 제한적이라 `/opt/homebrew/bin`, `/usr/local/bin` 같은 CLI 경로가 빠질 수 있었다.

## 수정

### 변경 파일

| 파일                                     | 변경 내용                                                |
| ---------------------------------------- | -------------------------------------------------------- |
| `src/server/pty/ptyManager.ts`           | macOS 기본 shell/PATH 보강, PTY spawn 에러 구체화        |
| `src/server/session/sessionManager.ts`   | PTY 시작 실패 원인을 `lastContext`에 저장                |
| `src/server/socket/handlers/terminal.ts` | attach 실패 시 저장된 실제 실패 원인을 callback으로 반환 |
| `tasks/todo.md`                          | 작업 계획/검증 결과 기록                                 |

### 수정 내용

- macOS packaged app에서 `SHELL`이 없으면 `/bin/zsh`를 우선 사용한다.
- macOS Finder 환경에서도 `PATH`에 `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`을 보강한다.
- `pty.spawn()` 예외에 command/cwd/detail을 포함한다.
- session attach 실패 UI가 실제 PTY 시작 실패 메시지를 받을 수 있게 한다.

## 검증

- [ ] MacBook packaged app에서 terminal session 생성 확인
- [x] `npm run desktop:build`
- [x] `npm run lint`
- [x] `npm run desktop:pack:local`

---

## 관련 노트

- [Orbit macOS Electron Preview](../features/2026-04-30_orbit-macos-electron-preview.md)
- [Packaged Local Readiness Diagnostics](2026-05-01_packaged-local-readiness-diagnostics.md)
