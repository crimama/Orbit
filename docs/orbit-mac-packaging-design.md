# Orbit macOS Packaging Design

Date: 2026-04-30

This document defines the packaging boundary for the Electron developer preview. It is intentionally conservative: Orbit can be launched through Electron for local and remote workflows, but this repository does not yet expose a verified `desktop:pack` command or claim notarized macOS distribution.

## Current Command Boundary

- `npm run desktop:dev`: builds Next, then starts Electron from the repository checkout.
- `npm run desktop:preview`: runs web build plus desktop typecheck and smoke validation.
- `npm run desktop:package-smoke`: audits whether packaging claims remain honest.
- `npm run desktop:pack:remote`: builds an unsigned Remote URL first `.app` without local server assets.
- `npm run desktop:pack:local`: builds an unsigned local-capable `.app` with `.next`, compiled server assets, Prisma schema, and production dependencies. This must be run on the target macOS architecture so native modules can be rebuilt for the Electron ABI.
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
- Server assets live under packaged app resources as `dist/server.js` plus `dist/node_modules/@` alias shims for `@/server` and `@/lib`.
- A packaged server is enabled only when `.next/BUILD_ID`, `dist/server.js`, `scripts/desktop-db-bootstrap.mjs`, and `prisma/schema.prisma` are present in the packaged app root.
- Prisma schema, generated client (`node_modules/.prisma/client`), and query engine artifacts must be included in the packaged resources.
- `node-pty` must be rebuilt for the Electron ABI on macOS. The local package disables broad electron-builder dependency rebuilds (`npmRebuild: false`) because optional SSH dependencies such as `cpu-features` can fail native rebuilds even though they are not needed for the local `This Mac` path. Instead, `desktop:rebuild:local-native` uses electron-rebuild's `--only node-pty` path.
- The local package keeps app resources unpacked (`asar: false`) so the child Electron-as-Node server can execute real files and native modules.
- Logs, database files, and generated runtime state should remain under the user's app data directory.

## Future Packager Sketch

The next concrete packaging pass is defined in `docs/orbit-mac-remote-app-packaging-plan.md`. It intentionally packages a Remote URL first unsigned `.app` before attempting full local `This Mac` server packaging.

An eventual `electron-builder` or equivalent config may need:

- `asarUnpack` entries for `node-pty`, Prisma query engines, and other native binaries.
- files/resources entries for Electron main/preload code, Next standalone output, Prisma schema, Prisma generated client, and server assets.
- after-install or build hooks that rebuild native modules for Electron.
- explicit app data paths for SQLite, logs, and first-run bootstrap.

The local-capable profile is now active as `desktop:pack:local`, but Linux can only validate the server build, smoke checks, and compiled runtime startup. The final proof is still a macOS run of the generated app because native rebuild and Finder launch behavior are platform-specific.

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
