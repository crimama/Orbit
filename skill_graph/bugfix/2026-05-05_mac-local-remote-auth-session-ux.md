# Mac Local Session + Remote Auth + Session UX 보완

## 배경

Electron/mac local 실행과 Tailscale remote 접속을 함께 지원하면서 다음 문제가 드러났다.

- remote 모드에서 token bootstrap이 network/header spoof 표면에 노출될 수 있음
- mac local app에서 agent CLI 세션이 Finder PATH 차이로 시작되지 않을 수 있음
- 모바일/앱 채팅 입력이 단일행이라 줄바꿈이 불가능함
- workspace tab에서 session/file 구분이 약함
- session lifecycle 후 project active session count가 stale로 남을 수 있음

## 결정

- remote 모드 기본 scope는 `tailscale`로 제한하고, `any`는 명시 opt-in으로만 허용한다.
- `ORBIT_ALLOW_REMOTE=true`에서 access token이 없으면 서버 시작을 중단한다.
- auth route는 `x-forwarded-for`/`x-real-ip`를 loopback 판정에 사용하지 않고, custom server가 실제 socket 주소로 주입한 내부 header만 신뢰한다.
- mac local agent command는 직접 binary spawn 대신 login shell에서 `command -v`로 해석한다.
- mobile chat composer는 `textarea`로 전환하고 `Cmd/Ctrl+Enter`를 전송 shortcut으로 둔다.
- workspace tab type은 작은 kind mark 하나와 session status dot으로 구분한다.
- dashboard/mobile session lifecycle 뒤 project list를 재조회해 active count를 서버 기준과 맞춘다.

## 검증

- `npx tsc --noEmit`
- `npm run lint`
- `DATABASE_URL=file:/tmp/orbit-mac-local-hardening-build.db npm run build`
- `ORBIT_ALLOW_REMOTE=true` + no token startup smoke: expected startup failure 확인
