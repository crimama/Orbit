# Team B Evaluator Report: Secrets, Profile UX, Diagnostics

Evaluator: worker-3 (Evaluator B)
Date: 2026-04-30
Evaluated baseline: Developer B final Lore commit `5d2725b` (tree-equivalent to integrated worktree HEAD `8c2e7eb`), Planner B artifact `ce957ec`, and task result commit reference `11230ee`.

## Verdict

**PASS** — Team B's implementation follows the Planner B artifact and satisfies the brief's required safety/diagnostic outcomes with one non-blocking hardening follow-up noted below.

## Scope and Plan Adherence

- **Allowed files respected:** Developer changes are limited to the Planner B allowed scope: `electron/types.ts`, `electron/main.ts`, `electron/connection.html`, `electron/urlValidation.ts`, `scripts/desktop-smoke.mjs`, and `docs/orbit-mac-electron-design.md`. No Team A packaging/runtime files were changed.
- **Plan followed:** The implementation adds session-only token UX, safe failure diagnostics, token-query URL rejection, smoke coverage, and documentation updates as requested.
- **No new dependencies:** The diff uses existing Electron/TypeScript/Node surfaces only.

## Safety Review

### Token persistence and profile storage

PASS:

- `electron/main.ts:119-123` strips top-level `sessionAccessToken` before profile sanitization.
- `electron/main.ts:126-135` keeps the submitted access token in memory and only appends it as a one-shot active connection query parameter.
- `electron/main.ts:138-141` removes the one-shot `token` from connection status URLs before status persistence/display.
- `electron/profileStore.ts:45` and `electron/profileStore.ts:149-161` still reject persisted profile fields whose keys look like password/passphrase/secret/token.
- `electron/urlValidation.ts:5-40` rejects embedded URL credentials and token-like query parameters (`token`, `access_token`, `sessionAccessToken`) before a URL can be normalized or persisted.
- `electron/connection.html:167-170` saves profiles with `includeSessionToken: false` and shows explicit saved-without-token copy.

### Logging and secret exposure

PASS:

- No new `console.log`/`console.error` logging was added in `electron/main.ts`, `electron/connection.html`, `electron/profileStore.ts`, `electron/urlValidation.ts`, or `electron/tunnel.ts`.
- `electron/main.ts:144-148` redacts one-shot `?token=` and `orbit_token=` values from surfaced error details.
- `electron/tunnel.ts` continues to keep raw SSH stderr internal and expose classified strings rather than raw stderr.

Non-blocking hardening follow-up:

- `electron/main.ts:144-148` redacts the active one-shot `token` parameter, but it is not a general URL query-stripper. Because `electron/urlValidation.ts` now rejects token-like saved URL query keys, this is acceptable for the implemented token model. A future hardening pass could strip all query/hash data from arbitrary error details to match the Planner B's strongest wording around not surfacing raw query strings.

## Diagnostics and UX Review

PASS:

- `electron/types.ts` extends status with optional `diagnostic` and `diagnosticCode` fields.
- `electron/main.ts:151-186` maps local, remote, and SSH failures into safe diagnostic statuses with actionable hints.
- Remote diagnostics distinguish invalid saved URLs from load failures (`REMOTE_URL_INVALID` vs `REMOTE_LOAD_FAILED`) and advise reachability, certificate trust, and path checks.
- SSH diagnostics advise reachability, host key trust, credentials/key agent, local port availability, remote Orbit port, and remote loopback checks.
- `electron/connection.html:36-41` and `electron/connection.html:87-98` clearly tell users remote/SSH tokens are used once and are not saved.
- `electron/connection.html:66-78` escapes status/diagnostic text before rendering with `innerHTML`, avoiding diagnostic HTML injection.

## Smoke and Documentation Review

PASS:

- `scripts/desktop-smoke.mjs:188-230` adds regression checks for session-only remote/tunnel tokens, safe diagnostics, and token-query URL rejection.
- `docs/orbit-mac-electron-design.md` documents endpoint/tunnel-only profile storage, token-query rejection, session-only token injection, safe diagnostics, and raw SSH stderr boundaries.

## Verification Evidence

- PASS `npm run desktop:typecheck` — exited 0.
- PASS `npm run desktop:smoke` — 21/21 checks passed.
- LIMITED `npx eslint electron/main.ts electron/connection.html electron/profileStore.ts electron/urlValidation.ts electron/tunnel.ts scripts/desktop-smoke.mjs` — failed only because this repo's ESLint parser does not parse `electron/connection.html` (`Parsing error: Expression expected`). This matches Developer B's reported tooling limitation.
- PASS `npx eslint electron/main.ts electron/profileStore.ts electron/urlValidation.ts electron/tunnel.ts scripts/desktop-smoke.mjs` — exited 0.
- PASS `git diff --name-only aea3fa2..8c2e7eb` — showed only Team B plan/artifact plus allowed Developer B files.
- NOTE `git diff --check aea3fa2..8c2e7eb` — reports trailing whitespace in Planner B artifact lines 3-4, not in Developer B product changes. This is cosmetic and outside Developer B's implementation scope.

## Required Fixes

None required before integration.

## Recommended Follow-ups

1. Consider broadening `redactConnectionError` to strip all URL search/hash components from arbitrary error strings, not just known one-shot token keys.
2. If saved-profile connect UX later needs token entry alongside saved endpoints, add an explicit saved-profile token prompt rather than introducing token persistence.
