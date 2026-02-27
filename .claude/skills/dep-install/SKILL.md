---
name: dep-install
description: Phase별 의존성 설치 게이트 — OUTLINE.md를 참조하여 잘못된 시점 설치를 차단합니다
allowed-tools:
  - Read
  - Bash
  - Grep
---

# /dep-install

**사용법**: `/dep-install <phase-number>`

## 동작

1. `OUTLINE.md`에서 `## Dependency Installation Order` 섹션 읽기
2. 요청된 Phase 번호의 의존성 설치 명령 추출
3. **게이트 검사**:
   - 선행 Phase(N-1)의 Done Criteria가 모두 체크되었는지 확인
   - Phase 1은 게이트 없이 즉시 설치 가능
   - 미완료 시 → 에러 + 미완료 항목 표시 + 설치 차단
4. 게이트 통과 시:
   - 해당 Phase의 `npm install` 명령 실행
   - 설치 결과 출력
   - `package.json` 변경 확인

## 예시

```
> /dep-install 1
✅ Phase 1 의존성 설치 가능 (선행 Phase 없음)
실행: npm install socket.io socket.io-client node-pty @xterm/xterm @xterm/addon-fit @xterm/addon-webgl
...설치 완료

> /dep-install 2
❌ Phase 1 Done Criteria 미완료:
  ⬜ 대시보드에서 프로젝트/세션 목록 조회
  ⬜ 24시간 미활동 세션 자동 정리 (GC)
→ Phase 1을 먼저 완료하세요. (/phase check 으로 상태 확인)
```

## 규칙

- `OUTLINE.md`의 Dependency Installation Order가 유일한 진실 소스
- Phase 순서 건너뛰기 불가
- Phase 4는 "TBD"인 경우 설치할 패키지 없음을 안내
- 이미 설치된 패키지는 npm이 자동으로 스킵하므로 중복 실행 안전
