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

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

### Security Defaults

- API/Socket are loopback-only by default (`127.0.0.1`).
- To allow remote access explicitly, set `ORBIT_ALLOW_REMOTE=true`.
- Optional: `ORBIT_REMOTE_SCOPE=tailscale` to accept only loopback/Tailscale clients.
- To require authentication, set `ORBIT_ACCESS_TOKEN`.
- Sign in on `/login` with the token (or open with `?token=<value>` once).
- Password-based SSH profiles require `SSH_PASSWORD_SECRET` (AES-GCM encryption key material).

### Tailscale-Only Access (Recommended)

For personal multi-device use, run Orbit so only Tailnet clients can connect:

```bash
export SSH_PASSWORD_SECRET="change-this-too"
npm run dev:tailnet
```

- `ORBIT_ACCESS_TOKEN` is auto-generated on first tailnet run and persisted at `~/.orbit/access-token`.
- To rotate it manually: `ORBIT_ACCESS_TOKEN_ROTATE=true npm run dev:tailnet`.
- Optional override path: `ORBIT_ACCESS_TOKEN_FILE=/custom/path/token npm run dev:tailnet`.
- To force first-time setup mode (no auto token): `ORBIT_TAILNET_AUTO_TOKEN=false npm run dev:tailnet`.

- This sets:
  - `ORBIT_ALLOW_REMOTE=true`
  - `ORBIT_REMOTE_SCOPE=tailscale` (rejects non-loopback/non-tailnet IPs)
  - `HOST=0.0.0.0`
- Then open from another Tailnet device: `http://<tailscale-ip>:3000/login`

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
