# Plan: Multi-pane N-way Split (2 row × 3 col = max 6 panes)

## Query
/translate multi-pane N-way split: 2row 3col max 6 panes

## Created
2026-03-17T17:26:00.363431

## Goal
현재 이진 트리(`children: [PaneNode, PaneNode]`) 기반 pane 시스템을 N-way split(`children: PaneNode[]`)으로 확장하여 최대 6 pane(2행 × 3열) 레이아웃을 지원.

## Current → Target

| 항목 | 현재 | 목표 |
|------|------|------|
| `PaneSplit.children` | `[PaneNode, PaneNode]` (2개 고정) | `PaneNode[]` (N개) |
| `PaneSplit.ratio` | `number` (단일) | `ratios: number[]` (각 자식 비율) |
| 최대 pane | 3 (실질적) | 6+ (무제한) |
| 같은 방향 split | 새 이진 노드 중첩 | 기존 split에 자식 추가 |

## Agents

### agent-01: paneTree.ts (데이터 모델 + 순수 함수)
- `src/lib/paneTree.ts`
- deps: 없음

### agent-02: UI 컴포넌트 (PaneRenderer + SplitDivider + MultiTerminal)
- `src/components/terminal/PaneRenderer.tsx`
- `src/components/terminal/SplitDivider.tsx`
- `src/components/terminal/MultiTerminal.tsx`
- deps: agent-01

## Execution
1. agent-01 (독립 실행)
2. agent-02 (agent-01 완료 후)
