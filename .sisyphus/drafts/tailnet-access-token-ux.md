# Draft: Tailnet ORBIT_ACCESS_TOKEN UX

Status: finalized into execution plan at `.sisyphus/plans/tailnet-access-token-ux.md`.

## Requirements (confirmed)

- "opencode 실행 시 tailnet으로 실행 시 ORBIT_ACCESS_TOKEN을 요구"하는 UX를 더 편리하게 만들고 싶다.

## Research Findings

- Tailnet dev runner가 `ORBIT_ACCESS_TOKEN` 없으면 즉시 종료한다: `scripts/run-tailscale.sh:14-17`.
- Remote 접근 + 토큰 인증은 Next middleware와 Socket 양쪽에서 강제된다.
  - HTTP/API: `middleware.ts`는 `ORBIT_ALLOW_REMOTE`가 true면 (그리고 remoteScope에 따라) IP를 검사한 뒤 토큰(쿠키/헤더/bearer)으로 authorize한다. 토큰이 비어있으면 현재 로직상 "authorized"로 간주될 수 있어, tailnet 모드에서 토큰 강제는 중요한 보안 가드레일이다: `middleware.ts:4-7`, `middleware.ts:59-75`, `middleware.ts:110-137`.
  - Socket.io: `server.ts`는 handshake에서 token/header/cookie/query를 확인한다: `server.ts:91-122`, `server.ts:170-176`.
- 로그인/세션 지속성은 이미 존재한다.
  - 로그인 페이지: `src/app/login/page.tsx`.
  - 세션 쿠키 설정 API: `src/app/api/auth/session/route.ts`는 성공 시 `orbit_token` httpOnly 쿠키를 세팅한다: `src/app/api/auth/session/route.ts:26-33`.
  - 미들웨어는 `?token=` 쿼리로 쿠키를 세팅하는 "magic link" 성격의 흐름을 지원하지만, 현재 `/login` 경로는 early-return으로 인해 이 기능이 적용되지 않는다(문서와 UX 혼동 가능): `middleware.ts:92-108`.
- Tailnet 실행 가이드는 README에 존재하며, `/login`과 `?token=` 단발 사용을 언급한다: `README.md:43-67`.

## Technical Decisions (proposed default)

- Confirmed: tailnet 모드에서 `ORBIT_ACCESS_TOKEN`이 없으면 자동 생성하고, 사용자 홈 디렉토리(`~/.orbit/`)에 퍼시스트한다(재시작해도 토큰 유지).
- Default: 콘솔에는 "페어링 링크"를 1회(최초 생성 시)만 출력하고, 이후에는 토큰을 노출하지 않고 `/login` 링크만 출력한다.
- Default: `/login?token=...` 형태의 링크로도 동작하도록 미들웨어 순서를 조정해, 사용자가 토큰 입력 없이도 클릭 1번으로 쿠키를 세팅할 수 있게 한다.

## Open Questions

- (선호) 콘솔에 `?token=`이 포함된 URL을 출력하는 것을 허용하는가? (기본은 최초 생성 시에만 출력)

## Scope Boundaries

- INCLUDE: tailnet runner UX 개선(토큰 자동 생성/재사용), 로그인 magic-link UX 정리(`/login?token=` 지원), 관련 문서/로그 메시지 개선.
- EXCLUDE: Tailscale user-identity 검증(SSO/OAuth), 키체인/OS credential store 연동(추가 설계 필요), 완전한 인증 시스템(JWT/refresh token) 재설계.
