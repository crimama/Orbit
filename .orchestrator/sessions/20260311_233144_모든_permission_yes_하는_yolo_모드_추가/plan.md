# Development Plan

## Query
모든 permission yes 하는 yolo 모드 추가

## Created
2026-03-11T23:31:44.725070

## Plan

### 분석 결과
- 기존 InterceptorMode: `"blacklist" | "allowlist" | "hybrid"` (types.ts:428)
- intercept() 메서드에서 mode별 분기 처리 (interceptor.ts:109-143)
- API route에서 VALID_MODES 배열로 유효성 검사 (mode/route.ts:9)
- 프론트엔드에 interceptor 모드 전환 UI 없음 (API만 존재)

### 작업 분해 (4개 파일, 순차)

1. **types.ts** — `InterceptorMode`에 `"yolo"` 추가
2. **interceptor.ts** — yolo 모드면 `intercept()` 즉시 true 리턴
3. **mode/route.ts** — VALID_MODES에 "yolo" 추가
4. **Dashboard UI** — YOLO 모드 토글 버튼 추가

### 판단: 직접 구현
- 총 변경량 ~30줄, 모든 파일이 타입에 연쇄 의존
- 에이전트 병렬화 불가 → 직접 순차 구현
