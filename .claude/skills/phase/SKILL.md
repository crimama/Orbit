---
name: phase
description: Phase 생명주기를 관리합니다 (현황/시작/점검/완료)
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
  - Bash
---

# /phase

**사용법**: `/phase [action]`

| Action | 설명 |
|--------|------|
| (없음) | 현재 Phase 현황 조회 |
| `start <N>` | Phase N 시작 (의존성 게이트 + ADR 생성) |
| `check` | 현재 Phase Done Criteria 점검 |
| `done` | 현재 Phase 완료 처리 |

## 동작

### `/phase` (현황 조회)

1. `OUTLINE.md` 읽기
2. 각 Phase의 Done Criteria 체크 상태 집계
3. 현재 진행 중인 Phase 표시

```
Phase 1: 인프라 구축 [3/6 완료]
  ✅ Custom Server Socket.io 통합
  ✅ 웹 터미널 쉘 실행
  ✅ PTY 세션 유지
  ⬜ 대시보드 목록 조회
  ⬜ E2E 세션→터미널 동작
  ⬜ 24h GC
```

### `/phase start <N>`

1. 선행 Phase(N-1) Done Criteria 전부 체크 확인
   - 미완료 항목 있으면 → 에러 + 미완료 항목 표시
2. `OUTLINE.md`에서 Phase N 의존성 설치 명령 확인
3. ADR 생성 안내: `skill_graph/decisions/`에 Phase 시작 ADR
4. `MEMORY.md` Current Status 갱신 안내

### `/phase check`

1. 현재 Phase의 Done Criteria를 `OUTLINE.md`에서 읽기
2. 각 항목에 대해 실제 코드/테스트 기반 점검 시도
3. 결과를 체크리스트로 출력

### `/phase done`

1. `/phase check` 실행
2. 모든 Done Criteria 통과 확인
   - 미통과 항목 있으면 → 에러 + 미통과 항목 표시
3. 통과 시:
   - `OUTLINE.md`의 Done Criteria에 체크 표시
   - Feature Note 생성 안내
   - `MEMORY.md` Current Status 갱신
   - 다음 Phase 안내

## 규칙

- Phase 순서 건너뛰기 불가 (Phase 1 미완료 → Phase 2 시작 불가)
- Done Criteria는 `OUTLINE.md`가 유일한 진실 소스(SSOT)
- Phase 완료 시 반드시 MEMORY.md 갱신
