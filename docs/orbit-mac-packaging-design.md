# Orbit macOS Packaging Design

Date: 2026-04-30

This document defines the packaging boundary for the Electron developer preview. It is intentionally conservative: Orbit can be launched through Electron for local and remote workflows, but this repository does not yet expose a verified `desktop:pack` command or claim notarized macOS distribution.

## Current Command Boundary

- `npm run desktop:dev`: builds Next, then starts Electron from the repository checkout.
- `npm run desktop:preview`: runs web build plus desktop typecheck and smoke validation.
- `npm run desktop:package-smoke`: audits whether packaging claims remain honest.
- `desktop:pack`: not active yet. Do not add it until the packaged runtime and macOS artifact checks below pass.

Linux CI can validate static packaging readiness, TypeScript, Next build output, and smoke scripts. It cannot verify that a `.app` launches on macOS, that native modules are rebuilt for the Electron ABI, or that Developer ID signing and notarization actually succeeded.

## Runtime Layout

Current preview runtime:

- Electron main/preload assets are loaded from the repo checkout.
- The local server is started by `electron/serverSupervisor.ts` in `repo-preview` mode.
- The server command is Node with `--import tsx <repo>/server.ts`.
- The SQLite database uses the app data `DATABASE_URL`.
- First-run database bootstrap runs before the readiness probe.

Future packaged runtime:

- Electron main/preload assets live in app resources.
- Server assets should live under packaged resources, for example `resources/server/server.js`.
- A packaged server should be enabled only after standalone server startup is verified from packaged files, not from the repo checkout.
- Prisma schema, generated client, and query engine artifacts must be included in the packaged resources.
- `node-pty` must be rebuilt for the Electron ABI and unpacked from ASAR when needed.
- Logs, database files, and generated runtime state should remain under the user's app data directory.

## Future Packager Sketch

The next concrete packaging pass is defined in `docs/orbit-mac-remote-app-packaging-plan.md`. It intentionally packages a Remote URL first unsigned `.app` before attempting full local `This Mac` server packaging.

An eventual `electron-builder` or equivalent config may need:

- `asarUnpack` entries for `node-pty`, Prisma query engines, and other native binaries.
- files/resources entries for Electron main/preload code, Next standalone output, Prisma schema, Prisma generated client, and server assets.
- after-install or build hooks that rebuild native modules for Electron.
- explicit app data paths for SQLite, logs, and first-run bootstrap.

This config is not active yet. Do not treat this sketch as proof that packaged macOS distribution works.

## macOS Verification Required Before `desktop:pack`

Before exposing `desktop:pack`, verify on macOS:

- Build on arm64 and, if supported, x64.
- Rebuild `node-pty` for the Electron ABI.
- Launch the `.app` from Finder and from the CLI.
- Confirm This Mac starts without repo checkout assumptions.
- Confirm Remote URL starts without a local server child process.
- Confirm a fresh user data directory runs DB bootstrap successfully.
- Confirm profile JSON does not store plaintext access tokens.
- Confirm signing and notarization only when credentials and commands are actually run.

## Non-goals

- Mac App Store sandbox support.
- Notarization claims from Linux CI.
- Persistent plaintext tokens.
