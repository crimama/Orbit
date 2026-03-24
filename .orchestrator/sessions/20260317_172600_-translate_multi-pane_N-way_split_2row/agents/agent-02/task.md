# Task: UI 컴포넌트 N-way split 대응 (PaneRenderer + SplitDivider + MultiTerminal)

## Agent
agent-02

## Status
pending

## Description
agent-01이 변경한 paneTree.ts의 N-way split 데이터 모델에 맞게 UI 컴포넌트 3개를 업데이트한다.

## 파일별 변경

### 1. SplitDivider.tsx
현재 props: direction, onRatioChange(ratio)
변경:
```typescript
interface SplitDividerProps {
  direction: 'horizontal' | 'vertical';
  splitId: string;
  index: number;  // 이 divider가 children[index]와 children[index+1] 사이에 위치
  onDividerDrag: (splitId: string, index: number, ratio: number) => void;
}
```
- 드래그 시 부모 split 전체 크기 기준으로 현재 위치 비율 계산
- onDividerDrag로 splitId, index, 절대 위치 비율 전달
- 더블클릭 시 균등 분배 (모든 자식 동일 비율)
- 기존 스타일(bg-neutral-800, hover:bg-blue-600, w-1/h-1) 유지

### 2. PaneRenderer.tsx
현재: 이진 split만 렌더링 (first + SplitDivider + second)
변경:
- N개 자식 렌더링: children.map으로 각 자식 사이에 SplitDivider 삽입
- 각 자식의 flex 비율: ratios 배열에서 가져옴 (`flex: 0 1 ${ratios[i] * 100}%`)
- SplitDivider에 splitId와 index 전달
- onRatioChange → onDividerDrag로 시그니처 변경

PaneRendererProps 변경:
```typescript
// onRatioChange를 아래로 변경:
onDividerDrag: (splitId: string, index: number, ratio: number) => void;
```

### 3. MultiTerminal.tsx
변경 사항:
1. **isPaneNode 검증 함수**: split 노드 검증을 N-way로 변경
   - children: Array.isArray && length >= 2 && 모든 원소가 isPaneNode
   - ratios: Array.isArray && length === children.length && 모든 원소가 number
   - ratio (legacy): number인 경우도 통과 (migrateLegacyTree에서 변환)

2. **sanitizeTreeSessions**: children 배열 전체 순회
   
3. **reorientSiblingLeafSplit**: N-way 자식 중에서 source/target을 찾아 방향 전환. 현재 이진 전용 → N-way에서는 인접한 두 leaf만 해당 시 reorient

4. **placeNewSessionByEdge**: N-way 지원

5. **handleRatioChange → handleDividerDrag**: 시그니처 변경
   ```typescript
   const handleDividerDrag = useCallback((splitId: string, index: number, absoluteRatio: number) => {
     setTree(prev => updateSplitRatioByDivider(prev, splitId, index, absoluteRatio));
   }, []);
   ```

6. **applyWorkspace**: migrateLegacyTree 호출 추가 (기존 workspace JSON 호환)

7. **runtimeState 복원**: isPaneNode 검증이 N-way 지원하므로 자동 호환

### 4. 컨벤션
- TypeScript strict mode
- 기존 코드 스타일 유지
- paneTree.ts에서 export된 새 함수들(flattenSameDirection, migrateLegacyTree, updateSplitRatioByDivider 등) 사용
- agent-01의 결과물인 paneTree.ts를 먼저 읽어서 정확한 인터페이스 확인 후 작업할 것

## Target Files
- `src/components/terminal/PaneRenderer.tsx`
- `src/components/terminal/SplitDivider.tsx`
- `src/components/terminal/MultiTerminal.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] PaneRenderer가 N개 자식을 렌더링
- [ ] SplitDivider가 index 기반 ratio 조정 지원
- [ ] MultiTerminal의 isPaneNode이 N-way 검증
- [ ] legacy workspace JSON 호환 (migrateLegacyTree 호출)
- [ ] handleDividerDrag가 splitId+index+ratio 처리
- [ ] tsc --noEmit 통과

## Notes
(Orchestrator may add coordination notes here)
