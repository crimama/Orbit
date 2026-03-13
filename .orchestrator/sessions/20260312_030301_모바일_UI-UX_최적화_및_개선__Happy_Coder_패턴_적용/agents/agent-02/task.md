# Task: VirtualKeyboard v2 — 터치 피드백 + 접기/열기 + 커스텀 키

## Agent
agent-02

## Status
pending

## Description
VirtualKeyboard.tsx를 개선하여 모바일 터미널 입력 경험을 향상시킨다.

## 현재 상태
- 160줄의 기본 가상 키보드
- onTouchStart 기반 입력 (300ms 딜레이 방지)
- Row 1: Esc, Tab, Ctrl, Alt, 화살표
- Row 2: 9개 특수문자 (|~\`/-{}[])
- safe-area-inset-bottom 적용됨
- 시각적 터치 피드백 없음

## 구현 사항

### 1. 터치 피드백 강화
- 키 터치 시 배경색 변화 (active:bg-neutral-600)
- 터치 시작/종료로 pressed 상태 관리
- 0.1초 동안 밝아졌다 원래대로 돌아오는 효과
- Ctrl/Alt 토글 상태를 더 뚜렷하게 (밝은 색상 + 밑줄)

### 2. 키보드 접기/열기 토글
- 키보드 상단에 작은 핸들 바 추가 (--- 모양)
- 핸들 터치로 키보드 접기/열기 토글
- 스와이프 다운으로도 접기 가능 (onTouchMove로 delta Y 감지)
- 접힌 상태에서는 핸들 바만 보임 (8px 높이)
- expanded/collapsed 상태를 useState로 관리

### 3. 모디파이어 키 개선
- Ctrl 활성 시 배경 파란색 (bg-blue-600)
- Alt 활성 시 배경 보라색 (bg-purple-600)
- 모디파이어 + 일반 키 조합 후 자동 해제 (one-shot 모드)
- 더블탭으로 모디파이어 잠금 (sticky 모드)

### 4. 키 크기 및 레이아웃
- 최소 터치 타겟: 44x44px (Apple HIG)
- 화살표 키를 약간 더 크게 (자주 사용)
- 키 사이 간격 균일하게 (gap-1.5)

## 참고 파일
- src/components/mobile/VirtualKeyboard.tsx (160줄)

## 컨벤션
- onTouchStart 사용 (onClick 아님 — 300ms 딜레이 방지)
- e.preventDefault() 필수 (기본 모바일 동작 차단)
- Tailwind CSS 클래스 사용

## Target Files
- `src/components/mobile/VirtualKeyboard.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] 터치 시 시각적 피드백 존재
- [ ] 접기/열기 토글 동작
- [ ] 스와이프 다운으로 접기 가능
- [ ] 모디파이어 상태가 색상으로 구분됨
- [ ] 최소 44px 터치 타겟

## Notes
(Orchestrator may add coordination notes here)
