---
name: bugfix
description: 버그 수정 워크플로우 — 근본 원인 분석 + 노트 생성 + 검증
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - Grep
---

# /bugfix

**사용법**: `/bugfix <bug-description>`

기존 버그픽스 노트:

```
!find skill_graph/bugfix -name '*.md' ! -name '_TEMPLATE.md' 2>/dev/null | sort!
```

## 동작

1. `$ARGUMENTS`에서 `<bug-description>` 파싱
   - 인자 없으면 → 기존 bugfix 노트 목록 출력 후 종료
2. **Autonomous Bug Fixing 원칙 적용**:
   - 직접 로그, 에러, 실패 테스트를 분석
   - 근본 원인 식별 → 수정 → 검증
   - "손을 잡아달라" 하지 말 것
3. `skill_graph/bugfix/_TEMPLATE.md` 기반으로 노트 생성:
   - 경로: `skill_graph/bugfix/YYYY-MM-DD_<bug-description>.md`
   - 증상, 원인, 해결, 변경 파일 섹션 채우기
4. **검증 단계** 실행:
   - `npm test` (테스트 존재 시)
   - `npx tsc --noEmit` (TypeScript 프로젝트)
   - 검증 결과를 노트의 `## 검증` 섹션에 기록

## 규칙

- 임시방편(workaround) 금지 — 근본 원인을 찾아 해결
- 수정 후 반드시 검증 실행
- 수정 과정에서 발견한 교훈은 `/lessons add`로 기록
- Demand Elegance: 수정이 hacky하면 재구현
