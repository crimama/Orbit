# Task: Mobile Terminal UX — 컴팩트 헤더 + YOLO 강조 + 폰트 조절

## Agent
agent-04

## Status
pending

## Description
TerminalPane.tsx의 모바일 터미널 경험을 최적화한다.

## 현재 상태
- TerminalPane.tsx: ~460줄
- 모바일 헤더에 세션 셀렉트, 프로젝트 뱃지, 상태, 워크스페이스 컨트롤, Split/Close/Kill 버튼이 모두 한 줄에
- YOLO 토글 버튼은 'Y' 한 글자 (너무 작아서 모바일에서 인지 어려움)
- 키보드 인셋 처리는 있으나 폰트 크기 조절 없음

## 구현 사항

### 1. 모바일 컴팩트 헤더
- isMobile일 때:
  - 세션 셀렉트 드롭다운을 풀 너비로
  - Split/Workspace 버튼 숨김 (데스크탑 전용)
  - Close/Kill만 남김
  - 프로젝트 이름은 상태 인디케이터 색상으로 대체 (공간 절약)

### 2. YOLO 토글 모바일 강화
- isMobile일 때 YOLO 토글을 더 크고 명확하게:
  - OFF: 'YOLO' 텍스트 + 회색 배경, 40px 높이
  - ON: 'YOLO ON' 텍스트 + 빨간 배경 + 미세 펄스 애니메이션
  - 위치: 헤더 오른쪽 끝 (Kill 버튼 옆)

### 3. 터미널 폰트 크기 조절
- 헤더에 A-/A+ 버튼 추가 (데스크탑/모바일 모두)
- fontSize 상태 관리 (기본 14px, 범위 10-22px, 2px 단위)
- TerminalView에 fontSize prop 전달
- localStorage에 저장하여 세션 간 유지

### 4. 모바일 세션 정보 패널
- 터미널 상단에서 아래로 스와이프하면 세션 상세 패널 표시
- 내용: 프로젝트명, 에이전트 타입, 세션 ID, 생성 시간, 상태
- 배경: 반투명 오버레이
- 다시 위로 스와이프하면 닫힘

## 참고 파일
- src/components/terminal/TerminalPane.tsx (~460줄)
- src/components/terminal/TerminalView.tsx (xterm.js 래핑)
- src/lib/hooks/useMobile.ts

## 컨벤션
- Tailwind CSS
- onTouchStart/onTouchMove/onTouchEnd 사용
- isMobile 조건부 렌더링

## Target Files
- `src/components/terminal/TerminalPane.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] 모바일에서 컴팩트 헤더 표시
- [ ] YOLO 토글이 모바일에서 40px 이상
- [ ] 폰트 크기 A-/A+ 버튼 동작
- [ ] 데스크탑 레이아웃 변경 없음

## Notes
(Orchestrator may add coordination notes here)
