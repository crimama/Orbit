# Critical 8건 코드 단순화 — 2026-03-11

> **상태**: 🟢 완료
> **범위**: 소규모
> **keywords**: simplify, type-safety, dead-code, socket-contract, as-assertion

---

## 동기

코드 단순화 — `/simplify ./` 커맨드로 전체 109개 파일 분석 후 Critical 8건 우선 수정

## Before / After

### 1. login/page.tsx — 동일 문자열 삼항 제거
```diff
- setError(isSetup ? "Password is required" : "Password is required");
+ setError("Password is required");
```

### 2. usePendingApprovals.ts — Socket.io 이벤트 계약 준수
```diff
- function onResolved(approvalId: string) {
+ function onResolved(approvalId: string, approved: boolean) {
```

### 3. sessions/[id]/page.tsx — 이중 as 단언 제거
```diff
- .then((json: ApiResponse<SessionInfo>) => {
-   if ("error" in json) {
-     setError((json as unknown as { error: string }).error);
+ .then((json: ApiResponse<SessionInfo> | ApiError) => {
+   if ("error" in json) {
+     setError(json.error);
```

### 4. interceptor/rules/route.ts — 암묵적 any 타입 명시
```diff
- const body = await request.json();
+ const body = (await request.json()) as {
+   id?: string; pattern?: string; ...
+ };
```

### 5. interceptor/mode/route.ts — 암묵적 any 타입 명시
```diff
- const body = await request.json();
- const mode = body.mode as string | undefined;
+ const body = (await request.json()) as { mode?: string };
+ const mode = body.mode;
```

### 6. sshManager.ts — Record → ConnectConfig
```diff
- connectConfig: Record<string, unknown>
+ connectConfig: Partial<ConnectConfig>
```

### 7. types.ts — 서버 전용 IPty 타입 분리
```diff
# src/lib/types.ts
- import type { IPty } from "node-pty";
- export interface PtySession { ... }

# src/server/pty/ptyManager.ts
+ import type { IPty } from "node-pty";
+ interface PtySession { ... }
```

### 8. projectFiles.ts — EACCES 3중 중첩 → isNodeErrCode 헬퍼
```diff
+ function isNodeErrCode(error: unknown, ...codes: string[]): boolean { ... }
- } catch (error) {
-   const code = typeof error === "object" ... // 12줄 중첩
+ } catch (error) {
+   if (!isNodeErrCode(error, "EACCES", "EPERM")) throw error;
+   // 평탄화된 에러 처리
```

## 변경 내역

| 파일 | 변경 내용 |
|------|----------|
| `src/app/login/page.tsx` | dead 삼항 분기 제거 |
| `src/lib/hooks/usePendingApprovals.ts` | `interceptor-resolved` 이벤트 시그니처 계약 준수 |
| `src/app/sessions/[id]/page.tsx` | `as unknown as` → `ApiResponse | ApiError` 유니온 |
| `src/app/api/interceptor/rules/route.ts` | PUT body 타입 명시 |
| `src/app/api/interceptor/mode/route.ts` | PUT body 타입 명시 |
| `src/server/ssh/sshManager.ts` | `Record<string, unknown>` → `Partial<ConnectConfig>` (3곳) |
| `src/lib/types.ts` | `IPty` import + `PtySession` 인터페이스 제거 (서버로 이동) |
| `src/server/pty/ptyManager.ts` | `PtySession` 인터페이스 로컬 선언 |
| `src/server/files/projectFiles.ts` | `isNodeErrCode` 헬퍼 추가, EACCES 처리 평탄화 |

## 검증

- [x] `npx tsc --noEmit` — 통과
- [x] `npm run lint` — 통과 (0 warnings, 0 errors)
- [x] 기존 동작 변경 없음 확인 (외부 인터페이스 유지)

---

## 관련 노트
- `skill_graph/refactor/2026-03-01_simplify-recent.md`
