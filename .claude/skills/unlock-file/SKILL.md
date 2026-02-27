---
name: unlock-file
description: .locks/ 파일 잠금 해제
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
---

# /unlock-file

**사용법**: `/unlock-file [<file-path> | stale | (빈 인자)]`

현재 잠금 상태:

```
!ls .locks/*.lock 2>/dev/null || echo "(잠금 없음)"!
```

## 동작

### 인자 없음 → 잠금 목록 조회
- `.locks/*.lock` 파일 전체 목록과 내용 출력
- 각 잠금의 경과 시간 표시

### `<file-path>` → 특정 파일 잠금 해제
1. 해당 파일의 잠금 파일(`.locks/<dashed-path>.lock`) 확인
2. 잠금이 현재 에이전트의 것인지 확인 (agent_id 비교)
   - 다른 에이전트의 잠금이면 경고 후 사용자 확인 요청
3. 잠금 파일 삭제
4. 해제 확인 메시지 출력

### `stale` → 좀비 잠금 정리
1. `.locks/*.lock` 파일 전체 스캔
2. timestamp가 30분 이상 경과한 잠금 식별
3. 좀비 잠금 목록 출력 후 사용자 확인
4. 승인 시 해당 잠금 파일 삭제

## 규칙

- 다른 에이전트의 잠금은 함부로 삭제하지 않음
- stale 정리 시 반드시 사용자 확인 후 삭제
- 삭제 전 잠금 내용을 출력하여 확인 기회 제공
