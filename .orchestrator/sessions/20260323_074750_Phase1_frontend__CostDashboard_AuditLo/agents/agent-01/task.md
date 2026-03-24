# Task: CostDashboard Component

## Agent
agent-01

## Status
pending

## Description
Home 화면에 표시할 비용/토큰 대시보드 컴포넌트.

## 파일: src/components/dashboard/CostDashboard.tsx (신규)
'use client' 컴포넌트.

### 기능
1. 마운트 시 GET /api/analytics/cost 호출하여 비용 데이터 조회
2. 상단 카드 3개: 오늘 비용, 이번 주 비용, 이번 달 비용 (각각 달러 표시)
3. 세션별 비용 테이블: 세션명 | 에이전트 타입 | 토큰 수 | 비용
4. 빈 상태: '토큰 추적 데이터가 아직 없습니다'

### API 응답 형태
GET /api/analytics/cost 는 { data: Array<{ sessionId, totalInputTokens, totalOutputTokens, totalCost, model }> } 반환

### 스타일링 (프로젝트 컨벤션)
- 다크 테마: bg-neutral-900, text-neutral-100 계열
- border-neutral-700/800
- 카드: rounded-xl border border-neutral-800 bg-neutral-950/70 p-4
- 텍스트 크기: text-xs, text-sm
- 비용 표시: text-green-400 (수익/절약), text-amber-400 (비용)

### 타입
import type { ApiResponse, ApiError } from '@/lib/types';

### 참고 컴포넌트
src/components/dashboard/SshVaultPanel.tsx — fetch/loading/error 패턴 참고

## Target Files
- `src/components/dashboard/CostDashboard.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] 비용 카드 3개 렌더링
- [ ] 세션별 비용 테이블
- [ ] 로딩/에러/빈 상태 처리
- [ ] 다크 테마 스타일
- [ ] npx tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
