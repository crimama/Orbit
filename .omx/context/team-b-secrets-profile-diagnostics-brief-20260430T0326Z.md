# Team B Brief: Secrets, Profile UX, Diagnostics

Workspace: `/home/hun/Orbit-mac`
Date: 2026-04-30

## Goal

Improve the Electron preview's connection profile safety and diagnostics without changing Team A packaging/runtime scope.

## Roles

- worker-1: Planner B. Write `.omx/team-artifacts/orbit-mac-next-stage/team-b-secrets-profile-plan.md`.
- worker-2: Developer B. Implement only after reading Planner B artifact.
- worker-3: Evaluator B. Review Planner B artifact and Developer B diff, then write `.omx/team-artifacts/orbit-mac-next-stage/team-b-evaluator-report.md`.

## Desired User-facing Outcome

- Remote URL and SSH tunnel profile handling should more clearly show that session tokens are not saved.
- Connection failures should be easier to diagnose from the Electron picker without exposing secrets.
- Profile persistence should avoid plaintext tokens and avoid accidentally logging one-shot token values.

## Likely Touchpoints

- `electron/main.ts`
- `electron/connection.html`
- `electron/profileStore.ts`
- `electron/urlValidation.ts`
- `electron/tunnel.ts`
- `scripts/desktop-smoke.mjs`
- `docs/orbit-mac-electron-design.md`

## Constraints

- Do not edit Team A packaging/runtime files unless adding a smoke assertion that protects profile/token safety.
- Do not persist plaintext access tokens in profile JSON.
- Do not log one-shot access token values.
- Keep Remote URL and This Mac behavior working.
- Keep changes small, reversible, and verifiable on Linux.

## Planner B Must Specify

- Exact UX/diagnostic behaviors to add.
- Exact files Developer B may edit.
- Acceptance criteria and verification commands.

## Developer B Minimum Target

- Fix any lint issue caused by session token stripping.
- Add or improve safe diagnostics for remote/tunnel connection failures.
- Add smoke coverage for no plaintext token persistence/logging.
- Preserve local and remote connection behavior.

## Evaluator B Must Check

- Plan was followed.
- No plaintext tokens are persisted or logged.
- Diagnostics are useful without exposing secrets.
- `npm run desktop:typecheck`, `npm run desktop:smoke`, and relevant lint/type checks pass.
