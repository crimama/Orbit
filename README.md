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

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Terminal | xterm.js + WebGL Addon |
| Visualization | React Flow (XyFlow) |
| Real-time | Socket.io (WebSocket) |
| Backend | Node.js + node-pty + ssh2 |
| Database | Prisma + SQLite |
| Mobile | PWA (next-pwa) |

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
