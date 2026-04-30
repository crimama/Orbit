# Orbit macOS Electron App Design

Status: Reviewed design, evaluator feedback incorporated
Date: 2026-04-30
Scope: `~/Orbit-mac` only

## Goal

Build a macOS desktop shell for Orbit that can connect to:

1. **This Mac**: start an embedded Orbit server on `127.0.0.1:<auto-port>` and load it in an Electron window.
2. **Remote URL**: load an already-running remote Orbit server URL.
3. **SSH Tunnel**: open a local SSH tunnel to a remote Orbit server, then load the forwarded loopback URL.

The first implementation should be a practical developer-preview mac app, not a Mac App Store-ready product. It must make local and remote connection switching real, but production-grade notarization can remain documented follow-up work.

## Current Evidence

- Orbit already starts through a custom Node server in `server.ts`, which prepares Next.js, creates an HTTP server, registers Socket.io, and listens on `HOST`/`PORT`.
- The server defaults to loopback unless `ORBIT_ALLOW_REMOTE=true`, which fits an Electron local-shell model.
- Runtime state depends on Node server capabilities: Socket.io, Prisma SQLite, `node-pty`, and `ssh2`.
- Prisma uses SQLite via `DATABASE_URL`.
- `node-pty` is a native module and must be packaged/rebuilt for Electron.
- In production, auth cookies currently become `Secure`; a local Electron app loading `http://127.0.0.1:<port>` needs an explicit desktop-local auth mode or it can loop on login.
- The repository currently has `prisma/schema.prisma` and `prisma/dev.db`, but no migration directory. Fresh app data DB creation must therefore be implemented deliberately.

## Architecture

```text
Orbit.app
├── Electron main process
│   ├── Connection profile store
│   ├── Local server supervisor
│   ├── Optional SSH tunnel supervisor
│   └── BrowserWindow lifecycle
├── Electron preload bridge
│   └── Minimal desktop status/settings API
├── Connection picker renderer
│   ├── This Mac
│   ├── Remote URL
│   └── SSH Tunnel
└── Orbit web app
    └── Loaded from local embedded server or remote/tunnel URL
```

## Connection Profiles

```ts
type OrbitDesktopConnectionProfile =
  | {
      id: string;
      kind: "local";
      name: string;
      port: "auto" | number;
      dataDir?: string;
    }
  | {
      id: string;
      kind: "remote";
      name: string;
      url: string;
    }
  | {
      id: string;
      kind: "ssh-tunnel";
      name: string;
      sshHost: string;
      sshPort: number;
      sshUsername: string;
      remoteOrbitPort: number;
      localPort: "auto" | number;
      privateKeyPath?: string;
    };
```

Profile metadata is stored in an Electron userData JSON file. The developer-preview implementation does not store token pointers or plaintext tokens in profile JSON. Tokens and generated local secrets are session-only until a later Keychain-backed production pass exists.

### Local Mode

Main process responsibilities:

- Pick an available local port.
- Build an app data directory under `~/Library/Application Support/Orbit`.
- Set environment variables for the child server:
  - `NODE_ENV=production`
  - `ORBIT_DESKTOP_LOCAL=1`
  - `HOST=127.0.0.1`
  - `PORT=<selected>`
  - `DATABASE_URL=file:<appData>/orbit.db`
  - `ORBIT_ACCESS_TOKEN=<generated session token>`
  - `ORBIT_DESKTOP_SESSION_ONLY_AUTH=1`
  - `ORBIT_DESKTOP_DISABLE_PASSWORD_SSH=1`
- Start the Orbit server as a child process.
- Wait for HTTP readiness before loading the window.
- Stop the child process on app quit.

### Desktop Local Auth

Local mode must not depend on `Secure` cookies over plain HTTP. The first implementation should add an explicit desktop-local server mode:

- `ORBIT_DESKTOP_LOCAL=1` is accepted only when `HOST` resolves to loopback.
- In this mode, the server can omit the `Secure` cookie attribute for loopback `http://127.0.0.1`.
- The access token remains required; Electron either opens the local URL with a one-shot `?token=...` that the server strips immediately, or calls the existing auth endpoint before loading the app.
- Remote URL mode must not receive desktop-local cookie relaxation.

Alternative HTTPS-local support can be added later, but is not required for this developer-preview app.

### Remote URL Mode

Main process responsibilities:

- Validate that the URL is `http` or `https`.
- Optionally append a session-provided login token only for first connection, then rely on Orbit's cookie/session handling.
- Do not start a local server.
- Show a reconnect/settings screen if the remote server is unavailable.
- Use the same BrowserWindow hardening as local mode, but remote pages must not get privileged preload APIs.
- Tokens are provided from session memory in the developer preview and injected only through existing Orbit auth mechanisms, not stored in the remote URL profile JSON. Keychain-backed token lookup is a later production pass.

### SSH Tunnel Mode

Main process responsibilities:

- Use a child `ssh` process initially rather than adding a new SSH tunnel library.
- Spawn with argv, not shell interpolation:
  - `ssh`
  - `-N`
  - `-L`
  - `127.0.0.1:<localPort>:127.0.0.1:<remoteOrbitPort>`
  - `-p`
  - `<sshPort>`
  - `-o`
  - `ExitOnForwardFailure=yes`
  - `-o`
  - `ServerAliveInterval=30`
  - optional `-i <privateKeyPath>`
  - `<sshUsername>@<sshHost>`
- Load `http://127.0.0.1:<localPort>`.
- Stop the tunnel process on disconnect/app quit.
- Keep Orbit server itself loopback-only on the remote host.
- Mark tunnel ready only after the local forwarded port accepts a request or the child exits.
- Surface stderr mapping for auth failure, host key failure, port collision, and remote refused connection.
- Do not store SSH passwords in this pass. Use OpenSSH key/agent/keychain behavior.

This mode is preferred over exposing a remote Orbit server publicly.

If reliable tunnel readiness or cleanup cannot be completed within the first team pass, SSH Tunnel mode may ship behind a disabled/preview gate while Local and Remote URL modes remain functional.

## Packaging Plan

Use Electron first with a developer-preview runtime path:

- Add Electron runtime and packaging dependencies.
- Add `electron/main.ts`, `electron/preload.ts`, and a small connection picker page.
- Add scripts:
  - `desktop:dev`
  - `desktop:build`
  - `desktop:preview`
- Configure a runtime bundle with this initial strategy:
  - Use Electron main to spawn a Node child process with the server entry.
  - For dev preview, the child may run `node --import tsx ... server.ts` from the repo checkout.
  - Do not expose `desktop:pack` until there is a real packaged runtime path. `desktop:preview` is only a build/typecheck/smoke validation command.
  - Add a separate packaging design path for compiled/standalone server, but do not pretend it is packaged or notarized until native rebuild and Prisma engine placement are verified.
  - Set `next.config.mjs` `output: "standalone"` only if the team also validates server startup from that layout.
  - Configure `asarUnpack` for native modules and Prisma engine artifacts when packaging is attempted.
  - Document the required native rebuild command for `node-pty` before packaged app claims.

Prefer Developer ID notarization later. Do not target Mac App Store sandbox in the first pass because local PTY, arbitrary project file access, SSH key reads, and child process execution conflict with sandbox constraints.

### First-Run DB Bootstrap

Fresh app data DB must not rely on copying `prisma/dev.db`.

Developer-preview path:

- Add a bootstrap step before local server readiness:
  - ensure app data directory exists
  - run a schema creation step against `DATABASE_URL`
  - prefer `npx prisma db push --skip-generate` in dev preview
- Document that production packaging should replace this with real Prisma migrations and `prisma migrate deploy`.
- Local server startup must fail with a clear desktop error if schema bootstrap fails.

## Required Code Changes

### Desktop shell

- `electron/main.ts`
  - app lifecycle
  - connection profile load/save
  - local server child process
  - SSH tunnel child process
  - BrowserWindow creation
- `electron/preload.ts`
  - expose minimal `window.orbitDesktop` API
- `electron/connection.html` or a small local renderer bundle
  - connection picker UI
  - last profile reconnect

Security contract:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true` when compatible with the preload bridge
- no privileged preload for arbitrary remote content
- preload APIs must be origin-gated to the local connection picker and trusted local Orbit URL only
- block unexpected navigation and `window.open`; open external links through the OS browser
- validate every IPC payload with small local type guards

### Server runtime support

- Add app-data-friendly env handling.
- Add `ORBIT_DESKTOP_LOCAL` cookie behavior guarded by loopback host.
- Ensure server can run from packaged paths.
- Ensure first-run DB setup is explicit enough for local mode.
- Keep loopback restriction as default.

### Build/package config

- `package.json`
  - Electron deps/scripts
  - packaging metadata
- `next.config.mjs`
  - consider `output: "standalone"` if packaging needs smaller server bundle
- Add `scripts/desktop-*` helpers if direct package scripts get too complex.

## Security Rules

- Default local server bind remains `127.0.0.1`.
- Never expose local mode on `0.0.0.0` from Electron unless explicitly configured.
- Store tokens/secrets outside the app bundle.
- Do not put tokens in remote URLs except as a one-shot compatibility fallback.
- SSH tunnel mode should prefer key auth and should not persist plaintext SSH passwords in this pass.
- Remote URL pages must not receive desktop IPC capabilities.
- Local desktop cookie relaxation applies only under `ORBIT_DESKTOP_LOCAL=1` and loopback host.

## Team Implementation Lanes

1. **Electron app shell lane**
   - Owns `electron/main.ts`, `electron/preload.ts`, connection picker surface.
   - Does not edit server auth or Prisma bootstrap files.
2. **Server/package lane**
   - Owns desktop preview scripts, packaged-runtime boundary, app data env wiring, first-run DB bootstrap.
   - Does not edit connection picker UI beyond wiring exposed commands.
3. **Connection profile/tunnel lane**
   - Owns profile types/store, URL validation, SSH tunnel process lifecycle.
   - Does not edit Next server internals.
4. **Verification/docs lane**
   - Owns smoke scripts, README/doc updates, validation checklist.
   - Does not own core implementation files except docs/test helpers.

## Acceptance Criteria

- `~/Orbit-mac` contains Electron mac app source and developer-preview package scripts.
- Local mode starts Orbit on loopback and opens it in an Electron window.
- Remote URL mode can open a configured remote Orbit URL without starting the local server.
- SSH tunnel mode has a concrete implementation or clearly gated preview path.
- Existing web app build still passes: `npm run build`.
- TypeScript passes: `npx tsc --noEmit`.
- Electron main/preload compile check passes.
- Fresh-userData local smoke verifies DB bootstrap reaches HTTP readiness or reports a clear bootstrap error.
- Remote URL smoke verifies no local server child is started and preload APIs are unavailable to remote content.
- SSH tunnel smoke verifies safe argv construction and either a working local forward or explicit disabled gate.
- Documentation states packaging limits and remaining notarization/native rebuild risks.

## Known Risks

- Electron native rebuild for `node-pty` may require platform-specific tooling.
- Prisma engine/client paths may need explicit packaging configuration.
- The current server entry uses `tsx` in `npm start`; production Electron should not depend on dev-time TS execution forever.
- Production packaging must replace the developer-preview repo-checkout runtime with a compiled or standalone server layout.
- SSH tunnel mode via system `ssh` depends on local OpenSSH availability and keychain/askpass behavior.

## Evaluator Feedback Incorporated

- Added desktop-local auth strategy for production HTTP loopback cookie behavior.
- Chose a developer-preview runtime path and separated it from later notarized packaging.
- Added first-run DB bootstrap requirement.
- Added Electron BrowserWindow/preload/navigation security contract.
- Removed token fields from persisted profile metadata and kept generated/local/remote tokens session-only until Keychain support exists.
- Expanded SSH tunnel argv/readiness/error handling.
- Split team lanes by ownership and made acceptance criteria testable.

## Verification Status — 2026-04-30 Team Pass

`scripts/desktop-smoke.mjs` is a dependency-free acceptance smoke for the Electron macOS developer preview. Run it from the repository root with:

```bash
node scripts/desktop-smoke.mjs
```

The smoke checks for the Electron preview surface, shell files, BrowserWindow hardening, remote preload isolation, navigation guardrails, connection profile/tunnel modules, SSH argv safety, desktop-local auth support, session-only desktop secrets, first-run DB bootstrap, and packaging-risk documentation. It exits non-zero while required desktop preview gaps remain.

Current implementation status:

- `electron/main.ts`, `electron/preload.ts`, and `electron/connection.html` implement the shell, file-based connection picker, and picker-only preload bridge.
- Local mode starts a supervised loopback Orbit server with app-data SQLite, explicit DB bootstrap, a generated session-only access token, and desktop-local cookie relaxation.
- Remote URL mode validates `http`/`https`, can pass an optional session-only one-shot token, and loads remote content in a BrowserWindow without privileged preload APIs.
- SSH tunnel mode uses system `ssh` with argv spawning, safe forwarding options, readiness probing, error classification, and cleanup.
- `desktop:preview` is the build/typecheck/smoke validation command. Real `desktop:pack` packaging is intentionally not exposed until native rebuild, Prisma engine placement, and standalone server startup are verified.

Recommended verification sequence:

1. `npm run desktop:typecheck`
2. `npm run desktop:smoke`
3. `npx tsc --noEmit`
4. `npm run lint`
5. `DATABASE_URL=file:/tmp/orbit-mac-desktop-smoke.db node scripts/desktop-db-bootstrap.mjs`
6. `npm run build`
7. `npm run desktop:preview`
