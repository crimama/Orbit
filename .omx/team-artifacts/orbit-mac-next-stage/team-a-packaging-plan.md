# Team A Packaging/Runtime Plan — Orbit macOS Next Stage

Planner: `worker-1`
Audience: `worker-2` Developer A and `worker-3` Evaluator A
Date: 2026-04-30

## Scope

Advance the Electron developer preview toward a practical macOS app packaging/runtime boundary without claiming notarized or production-ready packaging that we cannot verify from this Linux team environment.

This plan intentionally keeps Team A focused on packaging/runtime. Do **not** modify Team B's secrets/profile/diagnostics UX except where a packaging smoke check must assert that tokens are not written to profile JSON.

## Current baseline evidence

- `package.json` has `desktop:dev`, `desktop:typecheck`, `desktop:smoke`, `desktop:build`, and `desktop:preview`.
- No `desktop:pack` script is exposed, which is correct until a real packaging tool/config path exists.
- `electron/serverSupervisor.ts` currently starts local mode from the repo checkout with `node --import tsx <repo>/server.ts`, app-data `DATABASE_URL`, first-run DB bootstrap, and loopback-only desktop env.
- `docs/orbit-mac-electron-design.md` already states that `desktop:preview` is validation only and that packaging/native rebuild/Prisma/notarization remain risks.
- Existing smoke checks guard the preview boundary and fail if a fake `desktop:pack` appears without a packaging tool dependency.

## Decision: minimum viable packaging boundary

Implement a **staged packaging preparation path**, not a claimed distributable app:

1. Add a machine-checkable packaging audit script that validates whether the repo is ready to expose a packaging command.
2. Add an explicit packaging configuration/design document for a future `electron-builder` or equivalent path, but **do not** add `electron-builder` or `desktop:pack` in this pass unless Developer A can also verify config generation and native/runtime asset placement.
3. Refactor the local server supervisor just enough to make the runtime boundary explicit and testable:
   - preview runtime = repo checkout + `tsx` + `server.ts`
   - packaged runtime = future compiled/standalone server assets under app resources
4. Extend smoke coverage so regressions in the packaging boundary are caught before any `desktop:pack` script is exposed.

Rationale: adding a packaging dependency alone would create a misleading “packaging exists” signal. The useful next stage is to codify exactly what must be true before packaging is advertised.

## Developer A implementation instructions

### 1. Add a packaging audit script

Create `scripts/desktop-package-smoke.mjs`.

Required behavior:

- Dependency-free Node ESM script, same style as `scripts/desktop-smoke.mjs`.
- Read `package.json`, `docs/orbit-mac-electron-design.md`, and any new packaging doc/config files.
- Print `PASS`/`FAIL` lines and a final summary.
- Exit non-zero on any failure.
- Checks must include:
  1. `desktop:pack` is absent unless an actual packager dependency/config exists.
  2. Documentation explicitly says Linux CI cannot verify macOS `.app` execution/notarization.
  3. Documentation includes the future native rebuild requirement for `node-pty`.
  4. Documentation includes the Prisma client/engine placement requirement.
  5. Runtime code exposes or documents a clear preview-vs-packaged server entry boundary.
  6. The preview path still uses app-data `DATABASE_URL`, `ORBIT_DESKTOP_LOCAL`, and first-run DB bootstrap.
  7. No plan/config claims notarization support unless signing/notarization commands and verification are present.

Suggested package script:

```json
"desktop:package-smoke": "node scripts/desktop-package-smoke.mjs"
```

Update `desktop:build` to include this new smoke only if it stays fast and deterministic:

```json
"desktop:build": "npm run desktop:typecheck && npm run desktop:smoke && npm run desktop:package-smoke"
```

If adding it to `desktop:build` risks interfering with Team B, keep it as a separate script and document it; Evaluator A should still run it.

### 2. Add packaging design/path documentation

Create `docs/orbit-mac-packaging-design.md`.

Required contents:

- Current supported command boundary:
  - `desktop:dev` starts Electron from the repo checkout after `next build`.
  - `desktop:preview` runs web build + typecheck + smoke validation.
  - no `desktop:pack` / no notarized app claim yet.
- Future package layout, including:
  - Electron main/preload assets.
  - Next standalone/server assets if `next.config.mjs` later enables `output: "standalone"` and startup is verified from `.next/standalone`.
  - Prisma schema, generated client, and query engine artifacts.
  - `node-pty` native module unpack/rebuild requirements.
  - app-data DB path, logs path, and first-run migration/bootstrap path.
- Future `electron-builder` configuration sketch, clearly marked **not active yet**, including likely `asarUnpack` entries for native modules and Prisma engines.
- Required macOS-only verification before exposing `desktop:pack`:
  - install/build on macOS arm64 and, if supported, x64.
  - rebuild native modules for Electron ABI.
  - launch the `.app` from Finder and CLI.
  - verify This Mac starts without repo checkout assumptions.
  - verify Remote URL starts without local server child.
  - verify first-run DB bootstrap in a fresh userData directory.
  - verify no plaintext secrets in profile JSON.
  - verify signing/notarization only if credentials and commands are actually run.
- Explicit non-goals:
  - Mac App Store sandbox.
  - notarization claims from Linux CI.
  - persistent plaintext tokens.

Update `docs/orbit-mac-electron-design.md` with a short cross-link to this new packaging design doc in the Packaging Plan / Verification Status section. Keep the existing preview wording intact.

### 3. Make runtime boundary explicit in code

Touchpoint: `electron/serverSupervisor.ts`.

Keep behavior unchanged, but make future packaged startup less ambiguous. Preferred minimal approach:

- Introduce a small runtime-mode resolver, for example:

```ts
type OrbitServerRuntimeMode = "repo-preview" | "packaged-resources";

interface OrbitServerRuntimePlan {
  mode: OrbitServerRuntimeMode;
  cwd: string;
  command: string;
  args: string[];
  description: string;
}
```

- Current implementation should always return `repo-preview` unless an explicit, documented env override is present.
- The default command should remain the existing Node binary with `--import tsx <cwd>/server.ts`.
- If adding a `packaged-resources` branch, it must be guarded behind an env/config flag and fail with a clear error unless required files exist. Do not silently fall back from packaged mode to repo mode.
- Preserve existing `ORBIT_DESKTOP_LOCAL`, `ORBIT_DESKTOP_SESSION_ONLY_AUTH`, app-data `DATABASE_URL`, DB bootstrap, and readiness behavior.

Acceptance check: `npm run desktop:typecheck` and existing smoke must still pass.

### 4. Extend existing smoke coverage carefully

Touchpoints: `scripts/desktop-smoke.mjs`, maybe package script wiring.

Add checks only if they are deterministic and not brittle. Useful checks:

- New packaging doc exists and contains `desktop:pack`, `notarization`, `node-pty`, `Prisma`, and `Linux CI` or equivalent wording.
- `serverSupervisor.ts` contains the runtime boundary terms (`repo-preview`, `packaged-resources`, or equivalent names chosen by Developer A).
- `desktop:package-smoke` exists if the new audit script is added.

Avoid tests that require macOS or Electron GUI execution in Linux CI.

## Files Developer A may edit

Primary Team A scope:

- `package.json`
- `package-lock.json` only if package scripts/dependencies require npm to rewrite it; avoid new dependencies if possible.
- `electron/serverSupervisor.ts`
- `scripts/desktop-smoke.mjs`
- `scripts/desktop-package-smoke.mjs` (new)
- `docs/orbit-mac-electron-design.md`
- `docs/orbit-mac-packaging-design.md` (new)
- `skill_graph/features/2026-04-30_orbit-macos-electron-preview.md` if noting packaging status
- `tasks/todo.md` if adding a follow-up checklist

Do not edit Team B files (`electron/profileStore.ts`, `electron/main.ts`, `electron/connection.html`, token store/auth files, diagnostics/tunnel UX) unless the leader explicitly widens scope.

## Acceptance criteria for Developer A

Must be true before marking Developer A complete:

1. No fake packaging claim:
   - Either no `desktop:pack` script exists, or it is backed by a real packager dependency/config and verified generation path.
   - Docs clearly say notarized `.app` support is not verified in this Linux pass.
2. Runtime boundary is explicit:
   - Preview repo-checkout startup is named/documented in code or docs.
   - Future packaged-resources startup requirements are documented.
   - This Mac preview behavior remains unchanged.
3. App-data runtime remains safe:
   - Local server still uses app-data `DATABASE_URL`.
   - DB bootstrap still runs before readiness probe.
   - Loopback `ORBIT_DESKTOP_LOCAL` behavior remains enabled only for local mode.
4. Packaging audit exists:
   - `npm run desktop:package-smoke` or equivalent command passes.
   - Existing `npm run desktop:smoke` includes/cross-checks packaging boundary docs.
5. Verification passes:
   - `npm run desktop:typecheck`
   - `npm run desktop:smoke`
   - `npm run desktop:package-smoke` if added
   - `env -u DATABASE_URL npm run build`
6. Documentation is honest:
   - `docs/orbit-mac-packaging-design.md` separates current preview commands from future package commands.
   - Mac App Store sandbox, Developer ID signing, and notarization are presented as follow-up unless actually verified.

## Evaluator A checklist

Evaluator A should review Developer A's diff against this plan and the existing design doc.

Reject or request fixes if any of these occur:

- `desktop:pack` is added without a real packager dependency/config and at least config-level verification.
- Documentation implies notarization, signed distribution, Mac App Store readiness, or packaged `.app` launch was verified from Linux.
- Runtime code falls back from packaged mode to repo-preview mode without an explicit warning/error.
- `serverSupervisor.ts` stops using app-data `DATABASE_URL`, skips DB bootstrap, or weakens loopback/local auth env.
- New smoke checks require macOS GUI execution in CI.
- Team A edits Team B-owned secrets/profile UX beyond packaging-boundary assertions.
- Package scripts make `desktop:preview` slower or flaky without clear value.

Recommended evaluator commands:

```bash
npm run desktop:typecheck
npm run desktop:smoke
npm run desktop:package-smoke
DATABASE_URL=file:/tmp/orbit-mac-package-smoke.db node scripts/desktop-db-bootstrap.mjs
env -u DATABASE_URL npm run build
```

If `desktop:package-smoke` is not added, evaluator should mark that as a plan miss unless Developer A documents an equivalent deterministic check.
