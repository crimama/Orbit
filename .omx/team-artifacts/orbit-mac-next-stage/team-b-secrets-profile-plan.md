# Team B Secrets, Profile UX, and Diagnostics Plan

Planner: worker-1 (Planner B)
Date: 2026-04-30
Brief: `.omx/context/team-b-secrets-profile-diagnostics-brief-20260430T0326Z.md`

## Objective

Make the Electron connection picker safer and easier to diagnose by clarifying that access tokens are session-only, improving non-secret failure messages for Remote URL and SSH Tunnel connections, and adding smoke coverage that prevents plaintext token persistence or accidental token logging.

Developer B must keep the change small, Linux-verifiable, and outside Team A packaging/runtime scope.

## Current Baseline Observed

- `electron/profileStore.ts` already rejects profile fields whose keys look like `password`, `passphrase`, `secret`, or `token`, and remote profile sanitization stores only the normalized URL.
- `electron/main.ts` currently strips `sessionAccessToken` before `sanitizeProfile`, appends one-shot tokens only to active connection URLs, and uses raw thrown error messages in picker failure status.
- `electron/connection.html` already labels remote and tunnel token inputs as “not saved”, but the saved-profile list and failure area do not explain session-only handling or provide structured diagnostic hints.
- `electron/tunnel.ts` already classifies several SSH failures without returning raw stderr, but the picker has no explicit diagnostic detail channel and smoke coverage for token persistence/logging is minimal.

## Developer B Allowed Files

Developer B may edit only these files:

1. `electron/types.ts`
2. `electron/main.ts`
3. `electron/connection.html`
4. `electron/profileStore.ts`
5. `electron/urlValidation.ts`
6. `electron/tunnel.ts`
7. `scripts/desktop-smoke.mjs`
8. `docs/orbit-mac-electron-design.md`

Do **not** edit package/build/Team A packaging files such as `electron/bootstrap.cjs`, `scripts/desktop-package-smoke.mjs`, package metadata, installer/runtime packaging scripts, or unrelated app/server code. If a needed change appears outside the allowed list, stop and report the blocker to the leader.

## Required User-Facing Behaviors

### 1. Session-only token UX

Add explicit, visible copy in the picker that applies to both Remote URL and SSH Tunnel modes:

- Access tokens are used only for the current connection attempt.
- Access tokens are not saved into connection profiles.
- Saved profiles may contain endpoint/tunnel settings, but not session tokens.

Minimum implementation:

- Keep the existing password inputs named `sessionAccessToken` for active connects only.
- Add helper text near the token input and/or status area in `electron/connection.html`.
- When a profile is saved from Remote URL or SSH Tunnel mode, set a non-error status such as `Profile saved without access token. Enter a token when connecting if required.`
- When connecting from a saved Remote URL or SSH Tunnel profile, keep behavior unchanged: connect with the saved profile and no token unless the user enters one in the current form. Do not invent a token store.

### 2. Safe connection diagnostics

Add a structured, non-secret diagnostic hint that the picker can display when a connection fails.

Minimum implementation guidance:

- Extend `OrbitDesktopConnectionStatus` in `electron/types.ts` with optional safe fields, for example:
  - `diagnostic?: string`
  - `diagnosticCode?: string`
- In `electron/main.ts`, convert failures to safe picker status before rethrowing or returning to the UI. The status message should stay concise; the diagnostic should provide actionable next steps.
- Remote URL diagnostics should distinguish at least:
  - URL validation failures (bad scheme, missing host, embedded credentials) using the existing validation errors.
  - Browser load/navigation failures where possible, with a generic safe hint: verify the Orbit server is reachable, HTTPS certificate is trusted, and the URL path is correct.
- SSH Tunnel diagnostics should use the already-classified `electron/tunnel.ts` messages and add safe hints for common cases: host key verification, local port conflict, remote Orbit port refused/unreachable, SSH auth/connectivity failure, and readiness timeout.
- Do not include raw URLs with query strings, raw stderr, access tokens, passwords, private key contents, or environment values in diagnostic text.

Suggested implementation shape:

- Add a helper in `electron/main.ts` such as `safeConnectionFailureStatus(error, profile)` that returns `OrbitDesktopConnectionStatus` with `state: "failed"`, `profileId`, `message`, and optional diagnostic fields.
- Add a small sanitizer helper such as `redactUrlForStatus(urlLike)` if any URL is surfaced. It must strip `search` and `hash` before display.
- Update `electron/connection.html` status rendering to display `status.message` plus `status.diagnostic` when present.
- Avoid logging from these paths. If logging is absolutely necessary for debugging, log only sanitized diagnostics and never the request/profile object with `sessionAccessToken`.

### 3. Token persistence/logging guardrails

Keep or strengthen these invariants:

- `saveProfile` and `profileStore` never accept `sessionAccessToken`, `accessToken`, `token`, `password`, `secret`, or `passphrase` fields for persisted profiles.
- Remote profile URLs must reject embedded credentials and should not persist query tokens. If current behavior allows generic query parameters, Developer B must at minimum strip or reject token-like query parameters (`token`, `access_token`, `sessionAccessToken`) before storing. Prefer rejecting token-like query params with a clear validation error.
- One-shot tokens are only appended to the active load URL in memory and should never be written to profile JSON or raw logs.

## Implementation Notes by File

### `electron/types.ts`

- Add optional diagnostic fields to `OrbitDesktopConnectionStatus`.
- Keep fields serializable and safe for preload/browser delivery.

### `electron/main.ts`

- Keep `stripSessionSecrets` before `sanitizeProfile`.
- Make the destructured ignored token lint-clean (for example `const { sessionAccessToken, ...profile } = request; void sessionAccessToken;`) if lint complains about underscore naming.
- Wrap connection failures with safe status construction.
- Use sanitized URLs in status. Never set failed status `url` to a token-bearing URL.
- Preserve successful local, remote, and SSH tunnel connection behavior.

### `electron/connection.html`

- Add token-not-saved helper copy for Remote URL and SSH Tunnel fields.
- Render optional `diagnostic`/`diagnosticCode` from status in a readable, non-alarming style.
- Make saved-profile status text explicitly say tokens are not saved.
- Preserve current form submission and saved profile connect flows.

### `electron/profileStore.ts` and `electron/urlValidation.ts`

- Preserve existing secret-key rejection.
- If adding token-like query rejection, implement it in `validateRemoteOrbitUrl` or profile sanitization so both direct save and stored-profile load paths are protected.
- Keep existing support for normal HTTP/HTTPS remote URLs and loopback local URLs.

### `electron/tunnel.ts`

- Keep `spawn("ssh", argv, { shell: false })` and safe argv construction.
- Keep raw stderr internal only. Classification strings must be safe and non-secret.
- If adding diagnostic codes, add deterministic codes without raw stderr.

### `scripts/desktop-smoke.mjs`

Add or improve smoke assertions for:

- Remote/tunnel token UI uses session-only naming/copy (`sessionAccessToken`, `not saved`).
- Profile storage rejects token-like fields and does not define token-bearing profile types.
- Main process strips `sessionAccessToken` before sanitizing/saving.
- No raw `console.log`/`console.error` of token-bearing request/profile objects in Electron connection code.
- Remote URL validation rejects embedded credentials and token-like query parameters if implemented.
- Diagnostics are present but raw stderr/token strings are not exposed to picker status.

### `docs/orbit-mac-electron-design.md`

Document the final behavior briefly:

- Profiles store endpoints/tunnel metadata only.
- Tokens are one-shot/session-only.
- Diagnostics are safe, actionable, and redacted.

## Acceptance Criteria

Developer B is done only when all are true:

1. Remote URL and SSH Tunnel picker UX explicitly states that access tokens are not saved.
2. Saving a Remote URL or SSH Tunnel profile cannot persist plaintext token fields or token-like URL query parameters.
3. Failed Remote URL and SSH Tunnel connection attempts show an actionable safe diagnostic in the picker.
4. No code path logs `sessionAccessToken`, generated local access tokens, token-bearing URLs, raw SSH stderr, or full token-bearing profile/request objects.
5. Existing This Mac local connection flow remains unchanged and still uses local server tokens only in memory.
6. Existing Remote URL and SSH Tunnel successful connection behavior remains compatible, except unsafe embedded/token query credentials are rejected before persistence/use.
7. Smoke coverage fails if plaintext token persistence/logging protections regress.
8. Documentation describes the token and diagnostic model.

## Required Verification Commands

Run these from the repository root after implementation:

```bash
npm run desktop:typecheck
npm run desktop:smoke
npx eslint electron/main.ts electron/connection.html electron/profileStore.ts electron/urlValidation.ts electron/tunnel.ts scripts/desktop-smoke.mjs
```

If `npx eslint` does not support the HTML file in this repo configuration, rerun lint on the TypeScript/JavaScript subset and report the HTML lint limitation explicitly:

```bash
npx eslint electron/main.ts electron/profileStore.ts electron/urlValidation.ts electron/tunnel.ts scripts/desktop-smoke.mjs
```

Optional but recommended if touched behavior seems broad:

```bash
npm run desktop:build
```

## Evaluator B Checklist

Evaluator B should verify:

- [ ] Developer B changed only the allowed files.
- [ ] Plan instructions above were followed or deviations are documented with a good reason.
- [ ] Profile JSON cannot contain plaintext token/password/secret/passphrase fields.
- [ ] Remote URLs with embedded credentials are rejected.
- [ ] Token-like remote URL query parameters are rejected or stripped before persistence.
- [ ] `sessionAccessToken` is used only for the active connection attempt and not saved.
- [ ] Picker copy clearly tells users tokens are not saved.
- [ ] Failure diagnostics are actionable for remote/tunnel problems and contain no secrets.
- [ ] Raw SSH stderr is not displayed or logged.
- [ ] Token-bearing URLs are not shown in failed status or logs.
- [ ] This Mac, Remote URL, and SSH Tunnel flows still typecheck.
- [ ] `npm run desktop:typecheck` passes.
- [ ] `npm run desktop:smoke` passes.
- [ ] Relevant ESLint command passes or any pre-existing/tooling limitation is clearly documented.

## Scope Guard

This is not a request to add Keychain/credential-manager persistence, new dependencies, new packaging behavior, or a redesigned connection manager. If credential persistence is desired later, it should be planned separately with OS keychain integration and threat-model review.
