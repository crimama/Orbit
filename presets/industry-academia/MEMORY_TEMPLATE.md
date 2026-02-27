# [과제명] Project Memory

## Project Overview
- **Type**: 산학과제 ([기업명]) — [DL 분야: 이상탐지/객체검출/분류 등]
- **Framework**: [PyTorch / etc.]
- **Location**: [프로젝트 경로]
- **Period**: YYYY-MM ~ YYYY-MM
- **Paper Target**: [학회/저널명, 마감일]

## Stakeholders
- **지도교수**: [이름]
- **기업 담당**: [이름/부서]
- **연구원**: [이름]

## Timeline
| 마일스톤 | 기한 | 상태 |
|---------|------|------|
| 1차 중간보고 | | 🔴 |
| 중간 납품 | | 🔴 |
| 최종 납품 | | 🔴 |
| 논문 투고 | | 🔴 |

## Architecture
<!-- 핵심 모듈 간략 정리 -->
- `main.py`: 진입점
- `models/`: 모델 아키텍처
- `data_provider/`: 데이터 로더
- `configs/`: 실험 설정

## Running
```bash
# 실험 실행
# 데모 실행
```

## Installed Packages
<!-- torch, torchvision, timm, wandb 등 -->

## Data
- **공개 데이터**: [데이터셋명, 경로, 크기]
- **기업 데이터**: [경로, 포맷, 크기, 보안 주의사항]
- **전처리**: [resize, normalize 등 주요 전처리 기록]

## Baseline Results
<!-- 기준 성능. 모든 실험의 비교 대상. -->
- **[주요지표]**: X% | **[보조지표]**: Y%
- Backbone: [모델명], Input: [해상도], 조건: [N-shot 등]
- Details: `update_notes/analysis/baseline/_lessons.md`

## Experiment Process
6단계: 문제분석 → 가설 → 실험설정 → 결과 → 분석 → 피드백
- Template: `update_notes/experiments/_TEMPLATE.md`
- 가설 검증 결과 → `analysis/{주제}/_lessons.md` 승격
- `## 관련 노트`로 실험 간 연쇄 추적 (스킬 그래프)

## Key Experiment Results
<!-- 실험별 요약. 형식: 실험명, 핵심 수치, ✅/❌/⚠️, lessons 경로 -->

## SOTA Comparison
<!-- 경쟁 방법 대비 현재 위치 -->
| 방법 | 주요지표 | 비고 |
|------|---------|------|
| SOTA 논문 | | |
| Ours (current best) | | |

## Deliverables Status
- [ ] 중간 보고서
- [ ] PoC 모델 + 추론 코드
- [ ] 성능 리포트
- [ ] 데모 (Gradio/Streamlit)
- [ ] 최종 모델 가중치
- [ ] 최종 보고서
- [ ] 논문

## Meeting Action Items
<!-- 미완료 액션아이템 -->

## Paper Direction
<!-- 논문 방향, contribution 목록 -->

## Literature Survey
<!-- 핵심 관련 논문 -->
- 저장: `update_notes/analysis/literature_survey/`

## Lessons Learned
<!-- 검증된 패턴. 상세는 analysis/{topic}/_lessons.md 참조 -->
