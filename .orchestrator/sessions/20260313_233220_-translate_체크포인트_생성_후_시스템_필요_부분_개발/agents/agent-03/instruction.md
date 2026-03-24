# Components Layer Rules

## Architecture Boundary
- `src/server/`를 직접 import하지 마라. API 라우트(`/api/`)를 통해서만 접근.
- `src/lib/`의 타입과 유틸리티만 import 가능.

## Modules
- `terminal/` — xterm.js WebGL 터미널 (TerminalView가 핵심)
- `dashboard/` — 프로젝트/세션 2패널 대시보드
- `graph/` — React Flow 스킬 그래프 에디터
- `mobile/` — PWA 전용 UI (VirtualKeyboard, MobileLayout)

## Conventions
- 파일명: PascalCase (`TerminalView.tsx`)
- 컴포넌트: "use client" 명시 (서버 컴포넌트가 아닌 경우)
- 스타일: Tailwind CSS 유틸리티 클래스
- 상태: React hooks (useState, useEffect), 전역 상태는 Socket.io
- Socket 연결: `src/lib/useSocket.ts` 훅 사용

## Key Components
- `TerminalView` — xterm.js + WebGL + FitAddon + ResizeObserver
- `Dashboard` — 프로젝트(좌) + 세션(우) 레이아웃
- `SkillGraph` — React Flow 노드 에디터 + 라이브 트레이스
