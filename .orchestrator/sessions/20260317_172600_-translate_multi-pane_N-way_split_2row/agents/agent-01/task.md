# Task: paneTree.ts N-way split 데이터 모델 변환

## Agent
agent-01

## Status
pending

## Description
src/lib/paneTree.ts를 이진 트리에서 N-way 트리로 변환한다.

## 변경 사항

### 1. PaneSplit 인터페이스 변경
```typescript
export interface PaneSplit {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  ratios: number[];    // 각 자식의 비율 배열 (합 = 1.0). 예: 3자식이면 [0.33, 0.34, 0.33]
  children: PaneNode[]; // N개 자식 (최소 2개)
}
```

### 2. 함수별 변경

**splitPane(root, paneId, direction, newSessionId)**:
- 대상 leaf를 찾아 split으로 교체할 때, 부모 split이 같은 direction이면 부모의 children 배열에 새 leaf 추가 (N-way 확장)
- 다른 direction이면 기존처럼 새 split 노드 생성 (자식 2개로 시작)
- 단, 부모를 직접 수정하려면 재귀 구조를 변경해야 함 → 대안: leaf를 찾았을 때 항상 새 split 생성하되, 위의 정리(flatten)를 별도 패스로 수행하거나, 부모 컨텍스트를 전달하는 방식으로 구현
- 가장 실용적인 접근: splitPane에서 leaf를 split으로 교체 후, flattenSameDirection(root) 후처리로 같은 방향의 중첩 split을 병합

**새 함수 flattenSameDirection(root)**:
- 재귀적으로 순회하며, split의 자식 중 같은 direction의 split이 있으면 자식들을 병합
- 예: horizontal split > [leaf, horizontal split > [leaf, leaf]] → horizontal split > [leaf, leaf, leaf]
- ratios도 비례에 맞게 재계산

**closePane(root, paneId)**:
- N개 자식 중 대상 제거
- 남은 자식이 1개면 해당 자식으로 collapse
- 남은 자식이 2개 이상이면 ratios 재조정 (제거된 비율을 나머지에 균등 분배)

**findLeaf(root, paneId)**: children 배열 전체 순회

**updateLeafSession(root, paneId, sessionId)**: children 배열 전체 순회

**updateSplitRatio(root, splitId, index, delta)**:
- 시그니처 변경: ratio 대신 (index, delta) 또는 (index, newRatios)
- 인덱스 i와 i+1의 ratio를 조정하는 방식
- 기존 단일 ratio 방식에서 배열 기반으로 변경

**collectLeafIds(root)**: children 배열 전체 순회

### 3. 하위 호환
- 기존 저장된 workspace JSON에서 ratio: number, children: [a, b] 형태도 읽을 수 있도록 마이그레이션 유틸 함수 추가: migrateLegacyTree(node)
- ratio → ratios: [ratio, 1 - ratio]
- children: [a, b] 그대로 유지

### 4. 컨벤션
- TypeScript strict mode
- 순수 함수 (no side effects)
- 기존 코드 스타일 유지 (camelCase, let counter 패턴)

현재 파일 내용을 먼저 읽고 구조를 완전히 이해한 후 변환할 것.

## Target Files
- `src/lib/paneTree.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] PaneSplit.children가 PaneNode[]로 변경됨
- [ ] PaneSplit.ratios가 number[]로 변경됨
- [ ] splitPane이 같은 방향 split시 자식 추가 지원
- [ ] closePane이 N자식에서 정상 동작
- [ ] flattenSameDirection 함수 존재
- [ ] migrateLegacyTree 함수 존재
- [ ] tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
