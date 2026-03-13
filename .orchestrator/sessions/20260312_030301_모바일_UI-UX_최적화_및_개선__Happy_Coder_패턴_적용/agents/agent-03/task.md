# Task: MobileLayout + PWA 메타 + Viewport + useMobile 확장

## Agent
agent-03

## Status
pending

## Description
MobileLayout, layout.tsx, useMobile.ts를 개선하여 PWA 및 모바일 기반을 강화한다.

## 현재 상태
- MobileLayout.tsx: 22줄, h-[100dvh] 래퍼만 있음
- layout.tsx: 기본 PWA 메타 태그 (manifest, theme-color, apple-mobile-web-app-capable)
- useMobile.ts: 52줄, isMobile(768px) + isTablet(1024px) 감지

## 구현 사항

### 1. layout.tsx PWA 메타 강화
- viewport 메타에 viewport-fit=cover 추가 (safe area 활성화)
- apple-mobile-web-app-status-bar-style을 black-translucent로 설정
- 추가 아이콘 사이즈 (180x180 apple-touch-icon)

### 2. useMobile.ts 확장
- isLandscape: boolean 추가 (orientation 감지)
- matchMedia('(orientation: landscape)') 리스너 등록
- isStandalone: boolean 추가 (PWA 모드 감지, display-mode: standalone)
- prefersReducedMotion: boolean 추가

### 3. MobileLayout.tsx 강화
- Safe area inset 패딩 적용 (top, left, right — bottom은 VirtualKeyboard가 처리)
- 상단에 모바일 StatusBar 컴포넌트 추가:
  - 왼쪽: 연결 상태 인디케이터 (초록/빨강 점)
  - 중앙: 현재 프로젝트명 또는 'Agent Orbit'
  - 오른쪽: 현재 시간 (optional)
- StatusBar 높이: 28px, bg-neutral-950, border-b border-neutral-800
- standalone 모드에서만 StatusBar 표시 (브라우저에서는 주소바가 있으므로 불필요)

## 참고 파일
- src/components/mobile/MobileLayout.tsx (22줄)
- src/app/layout.tsx
- src/lib/hooks/useMobile.ts (52줄)

## 컨벤션
- React hooks는 camelCase (useMobile)
- Tailwind CSS, dark theme (bg-neutral-950)
- matchMedia + addEventListener 패턴 (기존 useMobile 참고)

## Target Files
- `src/components/mobile/MobileLayout.tsx`
- `src/app/layout.tsx`
- `src/lib/hooks/useMobile.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] viewport-fit=cover 메타 태그 존재
- [ ] useMobile에 isLandscape 필드 존재
- [ ] MobileLayout에 safe-area padding 적용
- [ ] standalone 모드에서 StatusBar 표시

## Notes
(Orchestrator may add coordination notes here)
