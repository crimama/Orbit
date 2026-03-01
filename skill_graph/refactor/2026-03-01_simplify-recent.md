# Simplify Recent 5 Files — Code Deduplication & Complexity Reduction

**Date**: 2026-03-01
**Scope**: 5개 파일, 56개 변경 (1102 + 831 + 677 + 546 + 307 줄)
**Result**: ✅ 타입 안전 + ESLint 통과

---

## 실행 내용

### Phase 1: `src/server/pty/interceptor.ts` (307줄)

| Item | Type | Impact | Before | After |
|------|------|--------|--------|-------|
| **I1** | 중복 제거 | `getPending()` / `getPendingById()` 공통화 | 16줄 | 4줄 |
| **I2** | 패턴 추출 | `isCacheValid()` 헬퍼 — 캐시 로직 단순화 | 22줄 | 6줄 |
| **I3** | 성능 개선 | `compileRegex()` 캐싱 — regex 재생성 제거 | - | +8줄 (캐시) |
| **I4** | 상수 추출 | `ALLOWLIST_DENY_RULE` 매직 객체 제거 | 인라인 | 12줄 상수 |
| **I5** | 타입 정확화 | `checkBlockWarn()` return type: `boolean \| Promise<boolean>` → `boolean` | - | - |

**검증**: ✓ tsc, ✓ lint

---

### Phase 2: `src/server/session/sessionManager.ts` (546줄)

| Item | Type | Impact | Before | After |
|------|------|--------|--------|-------|
| **S1** | 중복 제거 | `dockerInnerCommand()` 동일 리턴 분기 제거 | 3줄 | 1줄 |
| **S2** | 메서드 추출 | `startRemotePty()` — createSession + ensureSessionRunning 통합 | 50줄 중복 | 20줄 메서드 |
| **S3** | 상수 추출 | `AGENT_TYPES` — "terminal"/"codex"/"opencode" 매직 스트링 (5곳) | 인라인 | 상수 객체 |
| **S4** | 조기 리턴 | Docker guard 호이스팅 — L264 + L289 중복 제거 | 2곳 | 1곳 (맨 위) |

**검증**: ✓ tsc, ✓ lint

---

### Phase 3: `src/components/terminal/MultiTerminal.tsx` (677줄)

| Item | Type | Impact | Before | After |
|------|------|--------|--------|-------|
| **M1** | useCallback 추출 | `clearExitedPane()` — 5곳 중복 setExitedPanes 통합 | 5×6줄 | 1 × 8줄 |
| **M2** | PATCH/POST 통합 | `saveWorkspace()` 조건부 fetch 통합 | 35줄 | 20줄 |
| **M3** | 상수 추출 | `WORKSPACE_STORAGE_KEY` 매직 스트링 | 6곳 인라인 | 모듈 상수 |
| **M4** | 복잡도 감소 | `handleClose()` 로컬 변수 + 단일 setTree 정리 | 2× setState | 1× setState + 조건부 호출 |

**검증**: ✓ tsc, ✓ lint
**부가**: 불필요한 import 제거 (CreateWorkspaceLayoutRequest, UpdateWorkspaceLayoutRequest)

---

### Phase 4: `src/components/dashboard/ProjectHarnessPanel.tsx` (831줄)

| Item | Type | Impact | Before | After |
|------|------|--------|--------|-------|
| **H1** | setState 분리 | `updateGuided()` setGuided 안 setDraft 제거 | 10줄 | 4줄 |
| **H2** | 함수 추출 | `handleProviderChange()` — setDraft 콜백 side-effect 제거 | 20줄 인라인 | 별도 함수 |
| **H3** | 타입 상수 | `PERMISSION_FIELDS[]` — [label, key] 튜플 + `as` 캐스트 제거 | 인라인 | 타입 배열 |
| **H4** | 컴포넌트 추출 | `ConfigJsonEditor()` — 2개 textarea 중복 제거 | 2×10줄 | 1 × 13줄 컴포넌트 |
| **H5** | 가정 정리 | `draft.provider ?? "oh-my-opencode"` → `draft.provider` (기본값은 initialDraft에서) | - | - |

**검증**: ✓ tsc, ✓ lint

---

### Phase 5: `src/components/dashboard/Dashboard.tsx` (1102줄)

| Item | Type | Impact | Before | After |
|------|------|--------|--------|-------|
| **D1** | 헬퍼 추출 | `extractFirstActiveSessionId()` — walk 트리 탐색 2개 함수 통합 | 70줄 중복 | 25줄 메서드 |
| **D2** | 통합 함수 | `patchProject()` — PATCH 요청 3개 핸들러 (rename/color/config) 통합 | 55줄 | 15줄 |
| **D3** | 공통 함수 | `createSession()` — handleCreateSession + handleResumeClaudeSession 통합 | 50줄 중복 | 20줄 메서드 |
| **D4** | 중복 제거 | `openSessionInDashboard()` fallback 정리 — 4줄 setter 통합 | 2× 블록 | 1× 블록 |
| **D5** | memo 활용 | `activeSessions.length` — sessions.filter(active).length (2곳) 제거 | 2곳 | 메모이제이션 활용 |

**검증**: ✓ tsc, ✓ lint

---

## 개선 효과

### Code Metrics
- **파일 수**: 5개
- **총 라인 변경**: ~200줄 감소 (1102 + 831 + 677 + 546 + 307 = 3463 → ~3260)
- **중복 제거**: 8곳
- **헬퍼/메서드 추출**: 10곳
- **상수화**: 5곳 (WORKSPACE_STORAGE_KEY, AGENT_TYPES, PERMISSION_FIELDS, ALLOWLIST_DENY_RULE, isCacheValid)

### 품질 지표
- **타입 안전성**: ✅ TypeScript strict mode 유지
- **ESLint**: ✅ 모든 규칙 통과 (No warnings)
- **외부 인터페이스**: ✅ 변경 없음 (export 시그니처 동일)
- **기능 보존**: ✅ 모든 기존 동작 유지

---

## 설계 결정

### 1. setState 안 side-effect 제거
- **Phase 1 (H1, H2, M4)**: setGuided/setMode를 setState 콜백 밖으로 호이스팅
- **이유**: React hook 규칙 준수 + 명시적 제어 흐름

### 2. 트리 탐색 중복 제거 (D1)
- `walk()` 함수의 동일한 로직을 `extractFirstActiveSessionId()` 헬퍼로 통합
- 두 함수 모두 결과 활용 → 공통화 가능

### 3. 통합 vs 분리 판단
- **통합 (D2, D3)**: 3개 이상의 동일 패턴 → 1개 통합 함수
- **분리 유지 (D4)**: openSessionInDashboard — 역할이 다르지만 코드만 중복 → 4줄 중복만 제거

### 4. 캐싱 최적화 (I3)
- regex 객체 재생성 방지
- `compileRegex()` 내부 캐시 + `invalidateCache()`에서 함께 정리

---

## 기술 적 고려사항

### 보안
- CommandInterceptor: regex 컴파일 캐시 유지, invalidateCache 정기 호출
- SessionManager: Docker 환경 guard 조기 리턴 (fail-fast)

### 성능
- MultiTerminal: activeSessions memo 재사용 (filter 제거)
- Dashboard: memo 정확성 → dependency array 검증 완료

### 유지보수성
- PERMISSION_FIELDS 타입 배열 → 새 항목 추가 시 1곳만 수정
- AGENT_TYPES 상수 → 매직 스트링 제거, 리펙토링 시 find-replace 용이

---

## 관련 노트

- **Architecture**: `architecture.md`
- **Patterns**: `patterns.md`
- **이전 ADR**: `decisions/2026-02-28_harness-engineering.md`

---

## Checklist

- ✅ 타입 체크 (tsc --noEmit)
- ✅ ESLint (npm run lint)
- ✅ 외부 인터페이스 보존 (export 시그니처 동일)
- ✅ 기능 테스트 (수동 확인)
- ✅ 리팩토링 노트 작성

