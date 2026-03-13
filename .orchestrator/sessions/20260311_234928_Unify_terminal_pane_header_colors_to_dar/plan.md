# Plan: Dark Theme Unification + Session Persistence

## Context
Dashboard 좌측 사이드바와 상단 네비게이션은 dark neutral 테마를 사용하는데,
터미널 패인 헤더(TerminalPane)는 light slate 테마를 사용하여 이질감이 발생.
또한 브라우저를 닫으면 런타임 워크스페이스 상태가 sessionStorage와 함께 소실됨.

## Tasks

### agent-01: Dark Theme for TerminalPane.tsx
**File**: `src/components/terminal/TerminalPane.tsx`

현재 light 클래스들을 dark neutral 테마로 변환:
- 컨테이너: `border-slate-300 bg-white` → `border-neutral-800 bg-neutral-950`
- 헤더: `bg-slate-100/90` → `bg-neutral-900`
- Select: `border-slate-300 bg-white text-slate-900` → `border-neutral-700 bg-neutral-800 text-neutral-100`
- 텍스트: `text-slate-500/700/900` → `text-neutral-400/300/100`
- 호버: `hover:bg-slate-200 hover:text-slate-900` → `hover:bg-neutral-700 hover:text-neutral-200`
- 상태 뱃지: `bg-emerald-50 text-emerald-700` → `bg-emerald-900/30 text-emerald-400`
- 빈 패인: `bg-slate-100 text-slate-600` → `bg-neutral-950 text-neutral-500`
- 닫기: `hover:bg-red-100 hover:text-red-600` → `hover:bg-red-900/30 hover:text-red-400`

### agent-02: Session Persistence via localStorage
**File**: `src/components/terminal/MultiTerminal.tsx`

`sessionStorage` → `localStorage` 변환으로 브라우저 종료 후에도 워크스페이스 상태 유지:
- 런타임 워크스페이스 읽기/쓰기에서 `sessionStorage` → `localStorage`
- 이미 백엔드에서 PTY + scrollback이 유지되므로, 프론트엔드가 paneTree(sessionId 포함)만 복원하면 자동 재연결

## Verification
- `npx tsc --noEmit` 통과
- `npm run lint` 통과
- Dashboard에서 터미널 패인 헤더가 다크 테마로 통일
- 브라우저 새로고침/재시작 후 마지막 워크스페이스 상태 복원
