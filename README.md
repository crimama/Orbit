# Agent Orbit

**AI 에이전트 오케스트레이션 플랫폼**

로컬/원격(SSH) 서버의 AI 에이전트(Claude Code, Codex 등)를 하나의 웹 대시보드에서 관리합니다.
세션 지속성(resume), 시각적 스킬 그래프, 모바일 PWA 환경을 제공합니다.

## Core Features

- **Hybrid Workspace** — 로컬/SSH 원격 프로젝트 통합 관리
- **Smart Session Resume** — 에이전트 세션 자동 인덱싱 + `--resume` 복구
- **Visual Skill Graph** — React Flow 노드 기반 에이전트/스킬 시각화 + 라이브 트레이스
- **Mobile-First UX** — PWA + 가상 보조키 + 적응형 레이아웃

## Tech Stack

| Layer         | Technology                           |
| ------------- | ------------------------------------ |
| Frontend      | Next.js 14 (App Router) + TypeScript |
| Terminal      | xterm.js + WebGL Addon               |
| Visualization | React Flow (XyFlow)                  |
| Real-time     | Socket.io (WebSocket)                |
| Backend       | Node.js + node-pty + ssh2            |
| Database      | Prisma + SQLite                      |
| Mobile        | PWA (next-pwa)                       |

## Getting Started

### 1. Local Web Mode

한 대의 개발 머신에서 브라우저로 Orbit을 쓰는 기본 모드입니다. API와 Socket은 기본적으로 loopback만 허용합니다.

```bash
npm install
npx prisma generate
npx prisma db push

npm run dev
```

Open:

```txt
http://127.0.0.1:3000
```

처음 로그인 화면이 나오면 8자 이상의 비밀번호를 설정합니다. 이 최초 설정은 localhost에서만 허용됩니다.

### 2. Tailnet Remote Mode

다른 MacBook, iPad, 휴대폰 등에서 Tailscale 주소로 접속하려면 tailnet mode를 사용합니다.

```bash
export SSH_PASSWORD_SECRET="change-this-if-you-use-ssh-passwords"
npm run dev:tailnet
```

이 스크립트는:

- Tailscale 연결 상태를 확인합니다.
- `ORBIT_ACCESS_TOKEN`이 없으면 `~/.orbit/access-token`에 새 token을 생성합니다.
- `ORBIT_ALLOW_REMOTE=true`, `ORBIT_REMOTE_SCOPE=tailscale`, `HOST=0.0.0.0`로 서버를 실행합니다.
- 다른 Tailnet 기기에서 접속할 URL을 출력합니다.

Open from another Tailnet device:

```txt
http://<tailscale-ip>:3000/login
```

Token을 새로 만들려면:

```bash
ORBIT_ACCESS_TOKEN_ROTATE=true npm run dev:tailnet
```

### 3. Explicit Remote Mode

직접 remote server를 열 때는 token이 미리 설정되어 있어야 합니다. remote mode에서는 보안상 최초 비밀번호 설정을 허용하지 않습니다.

```bash
ORBIT_ACCESS_TOKEN="your-strong-password" \
ORBIT_ALLOW_REMOTE=true \
HOST=0.0.0.0 \
npm run dev
```

Remote scope 기본값은 `tailscale`입니다. 모든 remote client를 허용해야 하는 경우에만 명시적으로 설정합니다.

```bash
ORBIT_REMOTE_SCOPE=any
```

### 4. Production Build

```bash
npm run build
npm start
```

`DATABASE_URL`을 명시해야 하는 환경에서는 예를 들어:

```bash
DATABASE_URL=file:./orbit.db npm run build
DATABASE_URL=file:./orbit.db npm start
```

### 5. Mac App / Electron Client

이 repository는 Orbit server/PWA 기준입니다. macOS app으로 실행하는 별도 `Orbit-mac` 복사본을 쓰는 경우:

1. 먼저 이 서버를 local 또는 tailnet mode로 실행합니다.
2. mac app에서 `This Mac` 또는 `Remote URL` 연결 방식을 선택합니다.
3. Remote URL에는 `http://<tailscale-ip>:3000`처럼 서버 주소를 입력합니다.
4. local agent session이 안 뜨면 app 안의 terminal 오류 메시지에서 `codex`, `claude`, `opencode`가 login shell PATH에 있는지 확인합니다.

## Usage Guide

### Projects

1. `+ Project`로 local, SSH, Docker project를 추가합니다.
2. SSH project는 저장된 vault/profile을 재사용할 수 있습니다.
3. 프로젝트의 active session count는 서버의 `active` session 기준으로 표시됩니다.

### Sessions

1. 프로젝트를 선택합니다.
2. `Terminal`, `Claude Code`, `Codex`, `OpenCode` 중 세션 타입을 선택해 시작합니다.
3. 세션 탭은 `$` mark와 status dot으로 표시됩니다.
4. 파일 탭은 `F`, 파일 브라우저는 `DIR`, browser는 `WEB` mark로 구분됩니다.
5. 세션 시작 실패 시 UI에 startup 실패 원인이 표시됩니다.

### Chat Input

- Desktop chat: `Enter` sends, `Shift+Enter` inserts a newline.
- Mobile/app chat: normal `Enter` inserts a newline, `Cmd/Ctrl+Enter` sends, or use the `Send` button.

### Mobile PWA

Mobile 전용 화면:

```txt
http://<server>/m
```

Tailnet mode와 함께 쓰면 휴대폰에서도 동일한 session을 시작, 재진입, 종료할 수 있습니다.

### Security Defaults

- API/Socket are loopback-only by default (`127.0.0.1`).
- To allow remote access explicitly, set `ORBIT_ALLOW_REMOTE=true`.
- Remote access defaults to `ORBIT_REMOTE_SCOPE=tailscale`.
- `ORBIT_REMOTE_SCOPE=any` is an explicit opt-in for wider exposure.
- Remote mode requires `ORBIT_ACCESS_TOKEN` or a persisted access token before startup.
- Sign in on `/login` with the token (or open with `?token=<value>` once).
- Password-based SSH profiles require `SSH_PASSWORD_SECRET` (AES-GCM encryption key material).

## Troubleshooting

### `Forbidden: API is restricted to loopback access`

You started the default local server and opened it from another device. Use Tailnet mode:

```bash
npm run dev:tailnet
```

### `Remote access requires a configured ORBIT_ACCESS_TOKEN`

Remote mode cannot do first-time password setup. Use `npm run dev:tailnet` to auto-generate a token, or set:

```bash
ORBIT_ACCESS_TOKEN="your-strong-password"
```

### `The table main.AgentSession does not exist`

SQLite schema is missing. Run:

```bash
npx prisma generate
npx prisma db push
```

### Agent session starts but CLI is missing

Orbit starts local agent CLIs through the login shell. Verify the command is available:

```bash
zsh -lic 'command -v codex; command -v claude; command -v opencode'
```

If it is missing, install the CLI or add its directory to your shell profile PATH.

## Development

```bash
# 타입 체크
npx tsc --noEmit

# 린트
npm run lint

# 포매팅
npm run format

# Prisma DB 동기화
npx prisma db push
```

## Architecture

```
[Client: Next.js + xterm.js + React Flow]
        ↕ Socket.io (WebSocket)
[Backend: Node.js (TypeScript)]
    ├── PTY Manager (node-pty)
    ├── SSH Tunnel (ssh2)
    └── Session Watcher
        ↕
[Target: Local/Remote Agent Infrastructure]
```

## Project Structure

```
src/
├── app/              # Next.js App Router
│   └── api/          # API routes
├── components/
│   ├── terminal/     # xterm.js terminal
│   ├── graph/        # React Flow skill graph
│   ├── dashboard/    # Project/session dashboard
│   └── mobile/       # Mobile-specific UI
├── server/
│   ├── pty/          # PTY process manager
│   ├── ssh/          # SSH tunneling
│   ├── session/      # Session management
│   └── socket/       # Socket.io handlers
└── lib/              # Shared utilities
```

## License

MIT
