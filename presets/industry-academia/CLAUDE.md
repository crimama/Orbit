# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Principle (프로젝트 원칙)

**산학과제는 "연구 성과"와 "실용적 결과물"을 동시에 달성해야 한다.** 학술 논문 투고와 기업 납품물(보고서/PoC/데모) 양쪽의 요구사항을 균형 있게 충족시키되, 기업이 요구하는 일정과 산출물 기준을 최우선으로 관리한다. 연구적 깊이는 납품 일정을 초과하지 않는 범위 내에서 추구한다. 단순한 성능 trick 나열이 아닌, 명확한 insight와 원리에 기반한 방법론을 추구한다.

## Project Summary

<!-- 과제 한 문단 요약 -->
<!-- 예: "비전 기반 제조 결함 검출 시스템. 삼성전기와의 산학과제로, 소수 정상 샘플로 학습하여 실시간 결함 검출을 수행하는 경량 모델을 개발한다." -->

## Stakeholders

| 역할 | 이름/조직 | 주요 관심사 |
|------|----------|------------|
| 지도교수 | | 논문 성과, 연구 방향 |
| 기업 담당자 | | 납품물 품질, 일정 준수, 실환경 성능 |
| 연구원/학생 | | 구현, 실험, 논문 기여 |

## Timeline & Milestones

<!-- 과제 일정 관리. Claude가 우선순위 판단에 활용. -->
| 마일스톤 | 기한 | 산출물 | 상태 |
|---------|------|--------|------|
| 1차 중간보고 | YYYY-MM-DD | 진행 보고서, baseline 결과 | 🔴 |
| 중간 납품 | YYYY-MM-DD | PoC 모델, 성능 리포트, 데모 | 🔴 |
| 최종 납품 | YYYY-MM-DD | 최종 모델, 보고서, 추론 코드 | 🔴 |
| 논문 투고 | YYYY-MM-DD | 학회/저널 제출 | 🔴 |

## Commands

```bash
# 학습 실행
# PYTHONPATH=$(pwd):$PYTHONPATH python main.py --config configs/default.yaml

# Config override (OmegaConf 등)
# python main.py --config configs/default.yaml DATASET.name=custom MODEL.backbone=resnet50

# Baseline 실행
# python main.py MODEL.use_proposed=false

# 전체 실험 스위트
# bash scripts/run_experiments.sh

# Pilot mode (wandb off, 빠른 검증)
# PILOT=true bash scripts/run_experiments.sh

# 데모 실행 (기업 발표용)
# python demo/app.py

# 성능 리포트 생성
# python scripts/generate_report.py --output reports/

# GPU 지정
# CUDA_VISIBLE_DEVICES=0 python main.py --config configs/default.yaml
```

No test suite exists. Validation is done by running experiments and checking metrics.

## Architecture

### Pipeline Flow

```
<!-- DL 파이프라인 도식화 -->
Training: Data → Augmentation → Feature Extraction → Model → Loss → Optimizer
Testing:  Data → Feature Extraction → Model → Scoring → Metrics (AUROC, F1, etc.)
```

### Key Modules

- `main.py` — 실험 진입점, 학습/평가 오케스트레이션
- `models/` — 모델 아키텍처 정의
- `data_provider/` — 데이터 로더 (공개 데이터 + 기업 데이터 포맷 대응)
- `utils/` — metrics, visualization, augmentation 등
- `configs/` — 실험 설정 (YAML)
- `scripts/` — 실험 스위트, 리포트 생성 스크립트
- `demo/` — 기업 데모/발표용 (Gradio/Streamlit 등)
- `reports/` — 자동 생성 성능 리포트

### Score Convention

<!-- 점수 해석 규약 명시 (혼동 방지) -->
<!-- 예: "Lower score = more normal" 또는 "Higher anomaly_score = more anomalous" -->

### Extension Pattern

<!-- 새 모듈 추가 시 따라야 할 패턴 -->
<!-- 예: "@register('name') decorator + @dataclass" 또는 "models/ 아래 새 파일 → factory에 등록" -->

## Data Layout

```
data/
├── public/              # 공개 데이터셋 (MVTecAD, ImageNet 등)
│   └── {dataset_name}/
│       ├── train/
│       └── test/
└── proprietary/         # 기업 제공 데이터 (git 미추적!)
    ├── README.md        # 데이터 출처, 사용 조건, 라이선스 기록
    ├── raw/             # 원본 데이터
    └── processed/       # 전처리 완료 데이터
```

**주의**: 기업 제공 데이터는 `.gitignore`에 반드시 포함. 외부 유출 금지. 경로 하드코딩 금지 — 반드시 config에서 지정.

## Dependencies

<!-- 런타임 의존성 -->
<!-- 예: torch, torchvision, timm, omegaconf, wandb, numpy, pandas, scikit-learn, scipy, matplotlib, pillow, opencv-python-headless -->

## Config Parameter Tags

Config 주석에 사용하는 태그:
- `[TUNE]` = 자주 튜닝하는 하이퍼파라미터 (lr, batch_size, augmentation 등)
- `[ARCH]` = 아키텍처 선택 (backbone, loss function 등)
- `[DEPRECATED]` = 호환성 유지용 (미사용)

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
- 실험 시작 전 `report.md`에 1~3단계(문제분석/가설/설정)를 **먼저 작성** 후 실행
- 실험 완료 후 4~6단계(결과/분석/피드백)를 기록
- 가설 검증 결과가 반복 활용 가능하면 `analysis/{주제}/_lessons.md`로 승격
- 후속 실험은 `## 관련 노트`에서 선행 실험 report.md를 링크하여 연쇄 추적
- **납품 마일스톤과 연결**: 각 실험이 어떤 납품물에 기여하는지 report.md에 명시

**실험 디렉토리 구조:**
```
update_notes/experiments/YYYY-MM-DD_실험명/
├── report.md            # 6단계 프로세스 전체 기록
├── config_diff.yaml     # baseline 대비 변경된 config
└── logs/                # 실험 로그 (stdout, wandb export 등)
```

## Update Notes

실험, 분석, 버그픽스, 아이디어 등 유의미한 작업 시 반드시 `update_notes/` 아래에 `.md` 파일로 기록한다. **단순 누적 금지** — 주제별 계층 디렉토리로 구성.

```
update_notes/
├── experiments/              # 실험 기록 (6단계)
│   ├── _TEMPLATE.md
│   └── YYYY-MM-DD_실험명/
│       ├── report.md
│       ├── config_diff.yaml
│       └── logs/
├── analysis/                 # 분석 + 검증된 패턴
│   └── 주제명/
│       ├── YYYY-MM-DD_설명.md
│       └── _lessons.md       # 검증된 패턴 축적 (승격)
├── bugfix/                   # 버그 수정 기록
├── ideas/                    # 연구 아이디어
├── deliverables/             # 📦 납품물 관련 기록
│   ├── _TEMPLATE.md
│   └── YYYY-MM-DD_마일스톤명.md
└── meetings/                 # 📋 회의록
    ├── _TEMPLATE.md
    └── YYYY-MM-DD_참석자_주제.md
```

**스킬 그래프:**
- 노트 간 `## 관련 노트`로 상대 경로 링크
- 실험 → 분석 → 아이디어 → 후속 실험 흐름 추적
- 납품물/회의록에서 관련 실험 노트 역링크
- 반복되는 패턴이나 검증된 기법은 `analysis/{주제}/_lessons.md`로 승격하여 축적

## Deliverable Rules (납품물 관리)

- 모든 납품물 관련 의사결정/변경사항은 `update_notes/deliverables/`에 기록
- 납품 보고서 작성 시 `update_notes/experiments/`의 결과를 참조·인용
- 기업 미팅 후 `update_notes/meetings/`에 회의록 작성 (액션아이템 포함)
- **모델 납품 시 체크리스트**: 추론 코드, 가중치 파일, 환경 설정, 입출력 스펙 문서

## Coding Rules

- **모듈화 필수**: 새롭게 추가하는 모든 모듈/기능은 반드시 config에서 `enable: true/false`로 on/off 가능하게 구현한다. 과거 실험을 config만으로 정확히 재현할 수 있어야 한다.
- **Reproducibility**: seed 고정, config 기록, 환경 명시 (requirements.txt 또는 pyproject.toml)
- **Ablation-friendly**: 각 컴포넌트를 독립적으로 on/off 가능하게 설계
- **기업 데이터 보안**: proprietary 데이터 경로는 `.gitignore`에 포함, 하드코딩 금지
- **Demo-ready**: 주요 기능은 `demo/`에서 단독 실행 가능하게 유지
- **모델 경량화 고려**: 기업 배포 환경의 제약 (GPU 유무, 지연시간, 메모리) 인지

## Important Conventions

<!-- 프로젝트 고유 규약 -->
<!-- 예: import 방식, 텐서 형식 (B,C,H,W), 평가 프로토콜 등 -->
-
