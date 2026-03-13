# Task: 모바일 Dashboard & 세션 카드 개선

## Agent
agent-01

## Status
pending

## Description
Dashboard.tsx와 SessionList.tsx의 모바일 레이아웃을 개선한다.

## 현재 상태
- Dashboard.tsx: flex-col(모바일) → md:flex-row(데스크탑) 기본 반응형만 있음
- SessionList.tsx: 모바일에서 grid-cols-1, 세션 카드에 프리뷰 없음
- 프로젝트 목록과 세션 목록이 모바일에서 세로로 길게 나열됨

## 구현 사항

### 1. 모바일 탭 네비게이션 (Dashboard.tsx)
- isMobile일 때 프로젝트/세션/터미널을 탭으로 전환 (좌우 나열 대신)
- 탭 바를 상단에 배치: [Projects | Sessions | Terminal]
- 활성 탭만 렌더링하여 모바일 성능 확보
- 탭 전환 시 간단한 fade 트랜지션

### 2. 세션 카드 프리뷰 (SessionList.tsx)
- 각 세션 카드에 lastContext를 2줄까지 프리뷰 표시
- 세션 상태 뱃지를 카드 우상단에 배치
- 프로젝트 컬러를 카드 좌측 보더로 표시
- YOLO 상태인 세션은 빨간 뱃지 표시

### 3. 모바일 Bottom Action Bar (Dashboard.tsx)
- isMobile일 때 화면 하단에 고정 액션 바 표시
- 버튼: New Session, YOLO 글로벌 토글
- safe-area-inset-bottom 적용

## 참고 파일
- src/components/dashboard/Dashboard.tsx (1421줄)
- src/components/dashboard/SessionList.tsx
- src/lib/hooks/useMobile.ts (isMobile 감지)

## 컨벤션
- CLAUDE.md의 컨벤션 참조 (PascalCase 컴포넌트, Tailwind CSS)
- 기존 sm:/md: 반응형 패턴 유지
- 100dvh 사용 (모바일 동적 뷰포트)

## Target Files
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/SessionList.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] 모바일(375px)에서 탭 네비게이션 동작
- [ ] 세션 카드에 프리뷰 표시
- [ ] Bottom action bar 표시
- [ ] 데스크탑 레이아웃 변경 없음

## Notes
(Orchestrator may add coordination notes here)
