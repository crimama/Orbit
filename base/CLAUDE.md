# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Principle

<!-- 프로젝트의 핵심 철학. Claude가 모든 판단의 기준으로 삼을 원칙. -->
**[여기에 프로젝트의 핵심 원칙을 작성하세요]**

## Project Summary

<!-- 프로젝트를 한 문단으로 설명. Claude가 맥락을 빠르게 파악하는 데 사용. -->

## Commands

```bash
# 프로젝트 빌드/실행/테스트 명령어
# python main.py --config configs/default.yaml
```

## Architecture

### Pipeline / Data Flow

```
<!-- 프로젝트의 핵심 흐름을 간결하게 도식화 -->
Input → Processing → Output
```

### Key Modules

<!-- 주요 파일/모듈과 역할 -->
- `src/main.py` — 진입점
- `src/models/` — 모델 정의
- `src/utils/` — 유틸리티
- `configs/` — 설정 파일

### Conventions

<!-- 프로젝트 고유 규약 (import 방식, 네이밍, score 해석 등) -->
-

## Dependencies

<!-- 런타임 의존성 + 환경 특이사항 -->

---

## Workflow Orchestration

### 1. Plan Node Default
- 3단계 이상이거나 아키텍처 결정이 필요한 작업은 **반드시 plan mode 먼저**
- 작업 중 예상치 못한 문제가 생기면 STOP → 즉시 재계획. 억지로 밀어붙이지 말 것
- 구현뿐 아니라 **검증 단계**에도 plan mode 활용

### 2. Subagent Strategy
- 메인 컨텍스트 윈도우를 깨끗하게 유지하기 위해 **서브에이전트를 적극 활용**
- 리서치, 탐색, 병렬 분석은 서브에이전트에 오프로드
- 서브에이전트 하나에 한 가지 작업만 (focused execution)

### 3. Self-Improvement Loop
- **사용자의 수정/지적이 있을 때마다**: `tasks/lessons.md`에 해당 패턴을 기록
- 세션 시작 시 `tasks/lessons.md`를 먼저 확인하여 과거 교훈 리뷰
- 반복 검증된 패턴은 `update_notes/analysis/{주제}/_lessons.md`로 승격

### 4. Verification Before Done
- **작동을 증명하지 않은 채 완료 처리 금지**
- "시니어 엔지니어가 이 코드를 승인할 것인가?" 자문
- 테스트 실행, 로그 확인, 정확성 시연 후 완료

### 5. Demand Elegance (Balanced)
- 비자명한 변경에는 "더 우아한 방법이 있지 않은가?" 자문
- 수정이 hacky하게 느껴지면 우아한 해결책으로 재구현
- 단순·명백한 수정에는 생략 — 과잉 설계 금지

### 6. Autonomous Bug Fixing
- 버그 리포트가 주어지면: **그냥 고친다**. 손을 잡아달라고 하지 말 것
- 로그, 에러, 실패 테스트를 직접 분석하여 해결

---

## Task Management

1. **Plan First**: 구현 시작 전 `tasks/todo.md`에 체크리스트 형태로 계획 작성
2. **Verify Plan**: 구현 착수 전 계획 확인
3. **Track Progress**: 진행하면서 완료 항목에 체크
4. **Explain Changes**: 각 단계마다 고수준 요약 제공
5. **Document Results**: 완료 후 `tasks/todo.md`에 결과 섹션 추가
6. **Capture Lessons**: 수정/지적 발생 시 즉시 `tasks/lessons.md` 업데이트

```
tasks/
├── todo.md        # 현재 세션 계획·진행·결과 (세션마다 갱신)
└── lessons.md     # 수정·지적으로부터 추출한 누적 교훈 (영속적)
```

---

## Update Notes

유의미한 작업 시 반드시 `update_notes/` 아래에 `.md` 파일로 기록한다.

```
update_notes/
├── experiments/
│   ├── _TEMPLATE.md              # 실험/작업 보고서 템플릿
│   └── YYYY-MM-DD_작업명/
│       └── report.md
├── analysis/
│   └── 주제명/
│       ├── YYYY-MM-DD_설명.md
│       └── _lessons.md           # tasks/lessons.md에서 승격된 검증 패턴
├── bugfix/
│   └── YYYY-MM-DD_설명.md
└── ideas/
    └── YYYY-MM-DD_설명.md
```

**스킬 그래프:**
- 노트 간 `## 관련 노트` 섹션에 상대 경로로 링크
- 반복 패턴은 `analysis/{주제}/_lessons.md`로 승격

---

## Core Principles

- **Simplicity First**: 모든 변경은 가능한 한 단순하게. 최소한의 코드에만 영향을 줄 것
- **No Laziness**: 근본 원인을 찾아라. 임시방편 금지. 시니어 개발자 기준을 적용
- **Minimal Impact**: 변경은 필요한 것만. 불필요한 버그 유입 방지
