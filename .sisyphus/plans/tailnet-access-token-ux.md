# Tailnet ORBIT_ACCESS_TOKEN UX Improvement

## TL;DR

> **Summary**: Tailnet 모드에서 `ORBIT_ACCESS_TOKEN`을 수동으로 설정하지 않아도 안전하게(토큰 유지 + Tailnet IP 제한 유지) 접속/로그인할 수 있게 UX를 개선한다.
> **Deliverables**:
>
> - `npm run dev:tailnet`에서 토큰 자동 생성 + `~/.orbit` 퍼시스트 + 회전 옵션
> - `/login?token=...` 페어링 링크 지원 (token query가 /login에서도 작동)
> - Tailnet IP 제한이 `/login` 및 `/api/auth/session`에도 적용되도록 보안 구멍 제거
> - 문서/콘솔 출력 정리
>   **Effort**: Short
>   **Parallel**: YES - 2 waves
>   **Critical Path**: Tailnet runner token persistence → Middleware magic-link + IP gating → Docs + QA

## Context

### Original Request

- opencode를 tailnet으로 사용할 때 `ORBIT_ACCESS_TOKEN`을 요구하는 UX를 더 편리하게 만들 방법.

### Interview Summary

- 결정: tailnet에서 `ORBIT_ACCESS_TOKEN`이 없으면 자동 생성 + 퍼시스트(재시작에도 유지).

### Metis Review (gaps addressed)

- `/login` 및 `/api/auth/session`이 현재 middleware early-bypass로 인해 Tailnet IP gating이 적용되지 않는 보안 구멍을 반드시 막는다.
- `/login?token=...` magic-link가 현재 동작하지 않는 문제를 해결한다.
- (옵션) `NODE_ENV=production` + http tailnet 환경에서 `Secure` 쿠키로 인해 로그인 실패할 수 있어, 명시적 override를 제공할지 검토한다.

### Gap Classification (self-review)

- Critical
  - `/login` + `/api/auth/session`가 Tailnet IP gating을 우회하는 현재 보안 구멍
  - `/login?token=...`가 실제로 작동하지 않는 UX 단절
  - tailnet 실행 시 `ORBIT_ACCESS_TOKEN` 미설정이면 즉시 종료되는 초기 진입 장벽
- Minor
  - README/콘솔 문구가 실제 흐름(자동 생성/재사용)과 어긋날 수 있는 점
  - 토큰 회전(rotate) UX 부재
- Ambiguous (resolved defaults)
  - 토큰 저장 위치: 기본 `~/.orbit/access-token`, `ORBIT_ACCESS_TOKEN_FILE`로 오버라이드
  - 페어링 링크 노출 정책: 신규 생성/회전 시에만 출력

## Work Objectives

### Core Objective

- Tailnet-only 운영 시 토큰 설정/전달 과정을 “한 번 페어링” 수준으로 줄이되, remote 접근 보안(토큰 + Tailnet IP 제한)을 유지한다.

### Deliverables

- `scripts/run-tailscale.sh`가 토큰을 자동 생성/재사용하고, 안전한 파일 권한으로 저장한다.
- `middleware.ts`가 다음을 만족한다.
  - 실행 순서가 명확하다: (1) remote IP gating -> (2) `token` query 쿠키 세팅 -> (3) `/login` 처리 -> (4) `/api/auth/session` 처리 -> (5) 나머지 토큰 인증.
  - Tailnet IP gating이 `/login` 및 `/api/auth/session`에도 적용된다.
  - `/login?token=...&next=/...`를 통해 쿠키를 세팅하고 안전한 경로로 리다이렉트한다.
  - 이미 인증된 사용자가 `/login`에 접근하면 `next` 또는 `/`로 리다이렉트한다.
- `README.md`와 콘솔 안내가 실제 동작과 일치한다.

### Definition of Done (agent-verifiable)

- [ ] `ORBIT_ACCESS_TOKEN`이 unset이어도 `npm run dev:tailnet`이 종료되지 않고 dev 서버가 시작된다.
- [ ] 최초 실행 시 `~/.orbit/access-token`(또는 지정된 파일)에 토큰이 생성되고(권한 0600), 이후 재실행에서 같은 토큰을 재사용한다.
- [ ] `curl -i "http://127.0.0.1:3000/login?token=<token>&next=/"`가 `Set-Cookie: orbit_token=...`을 반환하고 `/`로 리다이렉트한다.
- [ ] 인증 쿠키 없이 `GET /api/skills`는 401을 반환하고, 인증 쿠키 포함 시 400(또는 200/201 등 “401이 아님”)을 반환한다.
- [ ] `ORBIT_REMOTE_SCOPE=tailscale`일 때 `/login` 및 `/api/auth/session` 요청은 non-tailnet IP로부터 403이 된다(테스트는 헤더 기반 시뮬레이션으로 수행).

### Must NOT Have

- 사용자/역할/DB 기반 auth 등 “새 인증 시스템” 추가 금지.
- 이번 변경에서 `NEXT_PUBLIC_*` 토큰 신규 도입/문서화 금지(기존 fallback은 legacy로 간주, 필요 시 후속 정리).
- 토큰을 매 실행마다 무조건 로그로 출력 금지(최초 생성 시에만, 또는 명시적 opt-in만).

## Verification Strategy

> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- Test decision: none (no existing test runner); 대신 `curl` 기반 검증 + Playwright(선택)로 UI 확인
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.txt` (executor가 생성)

## Execution Strategy

### Parallel Execution Waves

Wave 1

- Tailnet runner 토큰 자동 생성/퍼시스트
- Middleware: magic-link(`/login?token=`) + IP gating 적용

Wave 2

- README/콘솔 메시지 업데이트
- 보안/회귀 QA 시나리오 실행 및 증거 수집

### Security Defaults (execution-safe)

- Tailnet scope (`ORBIT_REMOTE_SCOPE=tailscale`)에서는 remote IP가 비어 있거나 판별 불가하면 기본 `403` (fail-closed)로 처리한다.
- `next`는 항상 상대 경로(`/...`)만 허용한다.
- 페어링 링크(`?token=`)는 신규 생성/회전 시에만 콘솔 출력한다.

### Dependency Matrix

- Task 1 blocks Tasks 3-4 (로그/문서 문구가 토큰 생성 UX에 의존)
- Task 2 blocks Tasks 4 (QA 시나리오가 middleware 동작에 의존)

## TODOs

> Implementation + Verification = ONE task.

- [ ] Task 1 - Tailnet runner token persistence
  - File: `scripts/run-tailscale.sh`
  - Rules:
    - `ORBIT_ACCESS_TOKEN` 있으면 우선 사용
    - 없으면 `ORBIT_ACCESS_TOKEN_FILE`(default: `$HOME/.orbit/access-token`)에서 읽기
    - 파일도 없으면 Node crypto로 생성 후 저장
    - 디렉토리 0700, 파일 0600 보장 (`umask 077`)
    - `ORBIT_ACCESS_TOKEN_ROTATE=true`면 강제 재생성
  - Verify:
    - unset 상태에서도 `npm run dev:tailnet` 기동
    - 토큰 파일 생성/재사용 확인

- [ ] Task 2 - Middleware control-flow fix (+ /login?token)
  - File: `middleware.ts`
  - Required order:
    1. remote IP gating (including `/login`, `/api/auth/session`)
    2. query token match -> set cookie -> redirect without `token`
    3. `/login`: authorized면 safe `next` or `/`로 redirect, 아니면 allow
    4. `/api/auth/session`: allow (route 자체에서 token 검증)
    5. others: 기존 token-required auth
  - Verify:
    - `/login?token=<valid>&next=/` -> Set-Cookie + Location `/`
    - invalid token은 cookie 미설정
    - tailnet scope + non-tailnet ip -> `/login` 403

- [ ] Task 3 - Cookie secure override (small hardening)
  - Files: `middleware.ts`, `src/app/api/auth/session/route.ts`
  - Add: `ORBIT_COOKIE_SECURE=true|false` override
  - Default: unset이면 기존 정책 유지
  - Verify:
    - override true/false에 따라 `Set-Cookie` Secure attribute 반영

- [ ] Task 4 - Docs alignment
  - Files: `README.md` (+ 필요 시 `scripts/run-tailscale.sh` 출력 문구)
  - Update:
    - tailnet 실행에 수동 `export ORBIT_ACCESS_TOKEN` 필수 아님
    - 토큰 저장 경로/회전 방법/페어링 링크 동작 명시
    - HTTP production-tailnet에서는 `ORBIT_COOKIE_SECURE=false` 안내(선택)

## Final Verification Wave (4 parallel agents, ALL must APPROVE)

- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real QA Runbook Execution — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy

- 1 commit 권장: `fix(tailnet): persist access token + enable /login?token pairing`

## Success Criteria

- Tailnet dev 실행이 “토큰 설정 없이도” 안전하게 한 번 페어링으로 끝난다.
- Tailnet IP 제한이 인증 엔드포인트에도 동일하게 적용된다.
