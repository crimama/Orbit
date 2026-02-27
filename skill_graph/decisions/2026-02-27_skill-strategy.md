# 프로젝트 전용 스킬 전략 — 2026-02-27

> **분류**: 컨벤션
> **keywords**: skill, phase, link-notes, dep-install, 워크플로우, 자동화

---

## 맥락

Agent-Orbit은 claude_code_init의 dev preset으로 초기화되어 7개 공통 스킬을 보유:
`/update-note`, `/lessons`, `/todo`, `/feature`, `/bugfix`, `/lock-file`, `/unlock-file`

Phase 기반 개발 프로세스를 강제하고, 노트 간 연결을 자동화하려면
프로젝트 고유 스킬이 필요하다.

## 선택지

| 옵션 | 장점 | 단점 |
|------|------|------|
| **A: 3개 추가 (채택)** — `/phase`, `/link-notes`, `/dep-install` | Phase 게이트 강제, 노트 연결 자동화, 의존성 실수 방지 | 스킬 유지보수 비용 |
| B: 5개 추가 — A + `/experiment`, `/analyze` | 실험 워크플로우도 커버 | dev 프로젝트에 연구 스킬 불필요 (YAGNI) |
| C: 추가 없음 — 수동 관리 | 유지보수 비용 0 | Phase 건너뛰기 실수, 노트 고립 문제 지속 |

## 결정

**옵션 A: 3개 프로젝트 전용 스킬 추가**

| Skill | 용도 | 위치 |
|-------|------|------|
| `/phase` | Phase 생명주기 관리 (현황/시작/점검/완료) | `.claude/skills/phase/` |
| `/link-notes` | 키워드 기반 노트 자동 연결 | `.claude/skills/link-notes/` |
| `/dep-install` | Phase별 의존성 설치 게이트 | `.claude/skills/dep-install/` |

**추가하지 않는 것:**
- `/experiment`, `/analyze` — dev 프로젝트, 연구 아님
- `/test` — feature/bugfix의 "Verification Before Done"에 이미 포함
- `/deploy` — Phase 4 이후 결정, 지금은 YAGNI

**이유:**
- Phase 게이트(`/phase`, `/dep-install`)가 OUTLINE.md의 규칙을 코드 수준에서 강제
- `/link-notes`가 `## 관련 노트` 빈 섹션 문제를 해결
- 3개는 유지보수 가능한 최소 단위

## 영향

- `.claude/skills/`에 3개 디렉토리 추가
- `OUTLINE.md`가 `/phase`와 `/dep-install`의 진실 소스(SSOT)
- `skill_graph/` 템플릿에 `> **keywords**:` 라인 추가
- `/update-note` 스킬 수정: 노트 생성 직후 자동 연결 시도
- `/link-notes`는 claude_code_init의 common skill로도 반영

---

## 관련 노트
-
