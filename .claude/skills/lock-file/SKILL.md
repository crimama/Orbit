---
name: lock-file
description: .locks/ 파일 잠금 생성 (멀티에이전트 충돌 방지)
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
---

# /lock-file

**사용법**: `/lock-file <file-path> [line-range] [description]`

현재 잠금 상태:

```
!ls .locks/*.lock 2>/dev/null || echo "(잠금 없음)"!
```

## 동작

1. `$ARGUMENTS`에서 파일 경로, 라인 범위(선택), 설명(선택) 파싱
   - 인자 없으면 → 현재 잠금 목록 출력 후 종료
2. `.locks/` 디렉토리에 해당 파일 잠금이 있는지 확인
   - 잠금 있고 라인 범위 겹침 → 충돌 경고 후 중단
   - 잠금 있지만 라인 범위 안 겹침 → 동시 수정 가능 안내
3. 잠금 파일 생성:
   - 경로: `.locks/<path-with-slashes-replaced-by-dashes>.lock`
   - 내용:
     ```json
     {
       "agent_id": "<현재 세션 식별자>",
       "file": "<대상 파일 경로>",
       "lines": "<라인 범위 또는 'all'>",
       "timestamp": "<ISO 8601>",
       "description": "<작업 설명>"
     }
     ```
4. 잠금 생성 확인 메시지 출력

## 규칙

- 라인 범위 미지정 시 `"all"` 사용
- 작업 완료 후 반드시 `/unlock-file`로 해제
- 30분 이상 된 잠금은 좀비로 간주될 수 있음
