# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Research Principle (연구 철칙)

**단순한 성능 향상이 목표가 아니다.** 연구로서 가치가 있으며 동시에 성능을 향상시킬 수 있는 **novelty 있는 방법론을 제안**하는 것이 최종 목표다. 모든 실험과 방법론 설계는 "왜 이 방법이 학술적으로 의미가 있는가?"를 먼저 답할 수 있어야 한다. Trick 나열이 아닌, 명확한 insight와 원리에 기반한 방법론을 추구한다.

## Project Summary

<!-- 연구 프로젝트 한 문단 요약 -->

## Commands

```bash
# 실험 실행
# python main.py --config configs/default.yaml

# Config override
# python main.py --config configs/default.yaml DATASET.shot=4 MODEL.backbone=resnet50

# Baseline 실행
# python main.py EXPANSION.use=false

# 전체 실험 스위트
# bash scripts/run_experiments.sh
```

No test suite exists. Validation is done by running experiments and checking metrics.

## Architecture

### Pipeline Flow

```
<!-- 연구 파이프라인 도식화 -->
Training: Data → Feature Extraction → Model Fitting
Testing:  Data → Features → [Core Method] → Scoring → Metrics
```

### Key Modules

<!-- 주요 모듈과 역할 -->
- `main.py` — 진입점, 실험 오케스트레이션
- `models/` — 모델 정의
- `utils/` — 유틸리티 (metrics, visualization 등)
- `configs/` — 실험 설정 (YAML)
- `data_provider/` — 데이터 로더

### Score Convention

<!-- 점수 해석 규약 명시 (혼동 방지) -->
<!-- 예: "Higher score = anomaly" 또는 "Lower score = more normal" -->

### Registry / Extension Pattern

<!-- 새 모듈 추가 시 따라야 할 패턴 -->

## Data Layout

```
<!-- 데이터 디렉토리 구조 -->
{data_path}/{dataset_name}/{category}/train/
{data_path}/{dataset_name}/{category}/test/
```

## Dependencies

<!-- 런타임 의존성 -->

## Config Parameter Tags

`[TUNE]` = 자주 튜닝하는 하이퍼파라미터
`[ARCH]` = 아키텍처 선택 (덜 변경)
`[DEPRECATED]` = 호환성 유지용 (미사용)

---

## Workflow Orchestration

### 1. Plan Node Default
- 3단계 이상이거나 아키텍처 결정이 필요한 작업은 **반드시 plan mode 먼저**
- 작업 중 예상치 못한 문제가 생기면 STOP → 즉시 재계획. 억지로 밀어붙이지 말 것
- 구현뿐 아니라 **검증 단계**에도 plan mode 활용
- 스펙을 앞에서 상세히 작성해 모호함을 최소화

### 2. Subagent Strategy
- 메인 컨텍스트 윈도우를 깨끗하게 유지하기 위해 **서브에이전트를 적극 활용**
- 리서치, 탐색, 병렬 분석은 서브에이전트에 오프로드
- 복잡한 문제일수록 서브에이전트를 통해 컴퓨팅을 더 투입
- 서브에이전트 하나에 한 가지 작업만 (focused execution)

### 3. Self-Improvement Loop
- **사용자의 수정/지적이 있을 때마다**: `tasks/lessons.md`에 해당 패턴을 기록
- 같은 실수를 반복하지 않도록 스스로 규칙을 작성
- 세션 시작 시 `tasks/lessons.md`를 먼저 확인하여 과거 교훈 리뷰
- 반복 검증된 패턴은 `update_notes/analysis/{주제}/_lessons.md`로 승격

### 4. Verification Before Done
- **작동을 증명하지 않은 채 완료 처리 금지**
- 변경 사항이 있을 때: main 동작과 diff하여 확인
- "시니어 엔지니어가 이 코드를 승인할 것인가?" 자문
- 테스트 실행, 로그 확인, 정확성 시연 후 완료

### 5. Demand Elegance (Balanced)
- 비자명한 변경에는 "더 우아한 방법이 있지 않은가?" 자문
- 수정이 hacky하게 느껴지면: "지금 알고 있는 모든 것을 감안해 우아한 해결책을 구현"
- 단순·명백한 수정에는 생략 — 과잉 설계 금지

### 6. Autonomous Bug Fixing
- 버그 리포트가 주어지면: **그냥 고친다**. 손을 잡아달라고 하지 말 것
- 로그, 에러, 실패 테스트를 직접 분석하여 해결
- 사용자의 컨텍스트 전환 없이 처리

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

## Experiment Process

실험은 반드시 아래 **6단계 프로세스**를 따른다. 템플릿: `update_notes/experiments/_TEMPLATE.md`

```
1. 문제 분석 (Problem Analysis)  → 현상 + 원인 추정 + 관련 선행 노트
2. 가설 설정 (Hypothesis)        → "X하면 Y 개선" + 근거 + 예상 수치
3. 실험 설정 (Experiment Design) → 대조군/실험군 + config diff + 실행 커맨드
4. 결과 (Results)                → 정량 결과표 + 로그 경로
5. 결과 분석 (Analysis)          → 가설 검증 (✅/❌/⚠️) + 상세 분석 + 부수 발견
6. 피드백 (Feedback)             → 교훈 + 다음 실험 제안 + _lessons.md 승격 여부
```

**실험 진행 규칙:**
- 실험 시작 전 1~3단계 먼저 작성 후 실행
- 실험 완료 후 4~6단계 기록
- 가설 검증 결과가 반복 활용 가능하면 `analysis/{주제}/_lessons.md`로 승격
- `## 관련 노트`로 실험 간 연쇄 추적

**실험 디렉토리 구조:**
```
update_notes/experiments/YYYY-MM-DD_실험명/
├── report.md            # 6단계 프로세스 전체 기록
├── config_diff.yaml     # baseline 대비 변경된 config
└── logs/                # 실험 로그
```

## Update Notes

```
update_notes/
├── experiments/
│   ├── _TEMPLATE.md              # 실험 보고서 템플릿 (6단계 프로세스)
│   └── YYYY-MM-DD_실험명/
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
- 노트 간 `## 관련 노트`로 상대 경로 링크
- 실험 → 분석 → 아이디어 → 후속 실험 흐름 추적
- 반복되는 패턴이나 검증된 기법은 `analysis/{주제}/_lessons.md`로 승격

---

## Core Principles

- **Simplicity First**: 모든 변경은 가능한 한 단순하게. 최소한의 코드에만 영향을 줄 것
- **No Laziness**: 근본 원인을 찾아라. 임시방편 금지. 시니어 개발자 기준을 적용
- **Minimal Impact**: 변경은 필요한 것만. 불필요한 버그 유입 방지
- **모듈화 필수**: 새롭게 추가하는 모든 모듈/기능은 config에서 `enable: true/false`로 on/off 가능하게 구현. 과거 실험을 config만으로 정확히 재현할 수 있어야 한다.
- **Reproducibility**: seed 고정, config 기록, 환경 명시
- **Ablation-friendly**: 각 컴포넌트를 독립적으로 on/off 가능하게 설계

## Important Conventions

<!-- 프로젝트 고유 규약 -->
-
