# Orbit macOS Next Stage Team Context

## Task Statement

Advance the existing Orbit macOS Electron developer preview toward a practical Mac app experience using `$team` with planner/developer/evaluator triads. The user asked that each team have planning, development, and evaluation roles; planners should concretize scope and instruct developers; developers should implement; evaluators should verify against plan/design and provide feedback; after all teams complete, the leader performs a final review and feedback pass.

## Desired Outcome

Implement the next stage on branch `feature/orbit-mac-electron-preview` in `/home/hun/Orbit-mac`:

1. A clearer packaging/runtime path that can produce or prepare for an actual Mac app bundle without pretending unverified notarized support exists.
2. A safer, more usable secrets/profile flow, especially Keychain-backed token persistence on macOS with non-mac fallback that remains safe.
3. Better connection UX and runtime diagnostics for This Mac / Remote URL / SSH Tunnel, including logs, reconnect/settings recovery, and Tailscale-friendly guidance.
4. Updated docs, smoke checks, and task/skill_graph notes.
5. Verification evidence and final evaluator pass.

## Current Facts / Evidence

- Current branch: `feature/orbit-mac-electron-preview`
- Current HEAD before team: `4b15c2a Make desktop dev build independent of local DATABASE_URL`
- Rollback tag before team: `rollback/pre-orbit-mac-next-stage-team-20260430T031458Z`
- Current developer preview works on user MacBook:
  - Remote URL works.
  - This Mac now works after fixing Node binary resolution and build-time DATABASE_URL.
- Existing verification from previous pass:
  - `npm run desktop:typecheck`
  - `npm run desktop:smoke` 17/17
  - `npm run desktop:preview`
  - `env -u DATABASE_URL npm run build`
- Existing design doc: `docs/orbit-mac-electron-design.md`
- Existing feature note: `skill_graph/features/2026-04-30_orbit-macos-electron-preview.md`

## Constraints

- Work only in `/home/hun/Orbit-mac`.
- Preserve the existing remote URL and This Mac behavior.
- Keep remote Orbit pages without privileged preload APIs.
- Do not persist plaintext tokens/passwords in profile JSON.
- Mac App Store sandbox is out of scope.
- Do not claim notarized production support unless actually implemented and verified.
- Linux CI/workspace cannot verify macOS `.app` execution; macOS-specific packaging must be documented as unverified here unless a command can run cross-platform.
- Use repo patterns and keep diffs reviewable.
- Worker commits are required by OMX team protocol.

## Team Structure

Six workers form two planner/developer/evaluator triads:

### Team A: Packaging Runtime Triad

- Worker 1, Planner A:
  - Owns detailed implementation plan for packaging/runtime.
  - Decide minimal packaging tool/config path.
  - Define exact developer tasks and acceptance checks.
  - Write/update design docs before developer completes.
- Worker 2, Developer A:
  - Implements packaging/runtime tasks from Planner A.
  - Likely touchpoints: `package.json`, `electron-builder.yml` or equivalent, `electron/serverSupervisor.ts`, `scripts/desktop-*`, docs.
  - Keep preview and packaged paths clearly separated.
- Worker 3, Evaluator A:
  - Reviews Developer A output against Planner A plan and existing design.
  - Flags unsupported packaging claims, missing native/Prisma/runtime handling, or broken preview behavior.

### Team B: Secrets, Profile UX, Diagnostics Triad

- Worker 4, Planner B:
  - Owns detailed implementation plan for Keychain/session token storage, connection UX, runtime diagnostics.
  - Define exact developer tasks and acceptance checks.
- Worker 5, Developer B:
  - Implements Planner B tasks.
  - Likely touchpoints: Electron profile/token store modules, `electron/main.ts`, `electron/connection.html`, logs/diagnostics helpers, docs/smoke.
  - Prefer no new dependency for Keychain unless Planner B justifies it. A macOS `security` CLI adapter with safe fallback is acceptable for this pass.
- Worker 6, Evaluator B:
  - Reviews Developer B output against Planner B plan and existing design.
  - Flags token persistence regressions, unsafe preload/IPC exposure, bad UX edge cases, or untestable claims.

## Required Coordination Protocol

- Planners must first create short plan artifacts under `.omx/team-artifacts/orbit-mac-next-stage/`.
- Developers must read the relevant planner artifact before editing.
- Evaluators must read the relevant planner artifact and developer diff before evaluating.
- Workers must avoid broad unrelated refactors.
- Workers must not edit files owned by the other triad unless they coordinate through leader mailbox.
- Every worker must commit its own changes before reporting completion.

## Likely Codebase Touchpoints

- `package.json`
- `package-lock.json`
- `electron/main.ts`
- `electron/connection.html`
- `electron/serverSupervisor.ts`
- `electron/profileStore.ts`
- New possible modules:
  - `electron/secretStore.ts`
  - `electron/diagnostics.ts`
  - `scripts/desktop-package-smoke.mjs`
  - `electron-builder.yml`
- `scripts/desktop-dev.mjs`
- `scripts/desktop-smoke.mjs`
- `docs/orbit-mac-electron-design.md`
- New doc likely:
  - `docs/orbit-mac-packaging-design.md`
- `tasks/todo.md`
- `skill_graph/features/2026-04-30_orbit-macos-electron-preview.md`

## Open Questions / Risk Flags

- Actual macOS `.app` cannot be validated from this Linux leader environment.
- `node-pty` native rebuild and Prisma engine placement may need macOS validation.
- Keychain support can be implemented via macOS `security` CLI without new deps, but live Keychain behavior cannot be verified on Linux.
- Adding `electron-builder` is a new dependency; acceptable only if it materially advances packaging and claims remain honest.

## Final Verification Expectations

At minimum run:

- `npm run desktop:typecheck`
- `npm run desktop:smoke`
- `npm run desktop:preview`
- `env -u DATABASE_URL npm run build`
- Any new smoke/package config checks added by the teams

Final leader must also inspect evaluator reports and apply required feedback before final response.
