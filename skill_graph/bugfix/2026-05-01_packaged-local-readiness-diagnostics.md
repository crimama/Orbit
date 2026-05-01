# Packaged Local Readiness Diagnostics — 2026-05-01

> **심각도**: 🟠 Major
> **상태**: 🟢 해결
> **keywords**: `electron` `macOS` `packaged-local` `this-mac` `readiness` `desktop-server-log`

---

## 증상

Mac packaged app에서 `This Mac` 연결 시 내부 Orbit 서버가 준비되기 전에 `/login` readiness probe가 `ECONNREFUSED`로 반복 실패했고, UI에는 최종 timeout만 표시되었다.

## 원인

기존 supervisor는 서버 child process stdout/stderr를 Electron process stdout/stderr에만 흘려보냈다. Packaged app에서는 이 출력이 사용자가 확인하기 어렵고, child process가 readiness 전에 종료되어도 readiness timeout과 구분되지 않았다.

## 수정

### 변경 파일

| 파일                           | 변경 내용                                              |
| ------------------------------ | ------------------------------------------------------ |
| `electron/serverSupervisor.ts` | 서버 stdout/stderr 로그 파일 기록, 최근 출력 진단 포함 |
| `tasks/todo.md`                | 작업 계획/검증 결과 기록                               |

### 수정 내용

- `~/Library/Application Support/Orbit/logs/desktop-server.log`에 packaged local server startup, DB bootstrap, server stdout/stderr를 append한다.
- `/login` readiness wait를 server child exit과 race해서 조기 종료 시 exit code/signal, runtime command, 최근 출력을 표시한다.
- 첫 packaged cold start를 고려해 기본 readiness timeout을 30초에서 90초로 늘렸다.

## 검증

- [ ] MacBook packaged app에서 재실행 후 실제 root-cause 로그 확인
- [x] `npm run desktop:build`
- [x] `npm run lint`
- [x] `npm run desktop:pack:local`

---

## 관련 노트

- [Orbit macOS Electron Preview](../features/2026-04-30_orbit-macos-electron-preview.md)
