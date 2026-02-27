---
name: feature
description: 기능 개발 워크플로우 — 노트 생성 + todo 연동 + plan 규칙 적용
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - EnterPlanMode
---

# /feature

**사용법**: `/feature <feature-name>`

기존 기능 노트:

```
!find skill_graph/features -name '*.md' ! -name '_TEMPLATE.md' 2>/dev/null | sort!
```

## 동작

1. `$ARGUMENTS`에서 `<feature-name>` 파싱
   - 인자 없으면 → 기존 기능 노트 목록 출력 후 종료
2. `skill_graph/features/_TEMPLATE.md` 기반으로 새 노트 생성:
   - 경로: `skill_graph/features/YYYY-MM-DD_<feature-name>.md`
   - 날짜, 기능명 자동 치환
3. `tasks/todo.md`에 기능 구현 체크리스트 추가:
   - `## 현재 작업`에 기능명 설정
   - `## 계획`에 단계별 체크리스트 작성
4. **Plan Node Default 적용**: 3단계 이상이면 plan mode 진입 권장

## 규칙

- 구현 시작 전 반드시 노트와 todo가 준비되어야 함
- Verification Before Done: 테스트 통과 증명 없이 완료 처리 금지
- 완료 시 노트의 `## 테스트`, `## 변경 파일` 섹션 채우기
- 완료 시 `/todo done` 으로 todo도 정리
