# Plan: UI Space Optimization — Maximize Session Pane

## 목표
불필요한 공간을 줄이고 세션 윈도우(pane) 크기를 최대화. 현재 ~123px 세로 손실 → ~55px로 축소.

## 에이전트 배정

### agent-01: Dashboard 레이아웃 압축
- **파일**: `src/components/dashboard/Dashboard.tsx`
- 상단 네비 바 압축 (py-2→py-1, h-7→h-6)
- 콘텐츠 wrapper padding 제거 (p-2 sm:p-3 → p-0)
- 사이드바 완전 숨김 모드 추가 (0px)

### agent-02: BorderlessWorkspace + TerminalPane 통합
- **파일**: `src/components/dashboard/BorderlessWorkspace.tsx`, `src/components/terminal/TerminalPane.tsx`
- Workspace 외곽 rounded-xl border 제거
- TerminalPane rounded-2xl → rounded-lg로 축소
- Pane 툴바 더 압축 (이미 py-0.5이므로 최소한의 변경)

### agent-03: globals.css text-xs 정상화
- **파일**: `src/app/globals.css`
- text-xs override (0.875rem → 표준 0.75rem) 제거하여 모든 툴바 높이 자연 축소
