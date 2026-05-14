# Orbit macOS Remote URL App Packaging Plan

Date: 2026-04-30

## Goal

Package the current Electron preview as an unsigned macOS `.app` whose first supported packaged use case is connecting to an already-running remote Orbit server over Tailscale or another trusted private network.

This plan intentionally does not make the packaged app responsible for starting the full Orbit server on the Mac. The packaged app is a thin, safer desktop shell for Remote URL first.

## User-Facing Result

The first packaged app should let a user:

1. Open `Orbit.app` from Finder.
2. Choose Remote URL.
3. Enter a URL such as `http://<tailnet-ip>:4444`.
4. Enter the current session access token.
5. Connect to the remote Orbit web UI inside Electron.

The app should not require the user to run `npm run desktop:dev` on the MacBook.

## Scope

Included in this phase:

- Add an Electron packaging dependency, preferably `electron-builder`.
- Add `desktop:pack:remote` or equivalent script for unsigned local `.app` generation.
- Package Electron main/preload/connection picker assets.
- Keep Remote URL, token-not-saved UX, safe diagnostics, and profile persistence.
- Add static smoke checks so packaging claims stay limited to Remote URL first.
- Document manual macOS verification steps.

Excluded from this phase:

- `This Mac` packaged local server startup.
- Next standalone server packaging.
- Prisma query engine packaging.
- `node-pty` Electron ABI rebuild.
- Developer ID signing.
- Notarization.
- Mac App Store sandboxing.
- Keychain credential persistence.

## Architecture Decision

Use a Remote URL first packaging profile.

The packaged app should start at the existing connection picker and support Remote URL immediately. `This Mac` may remain visible only if it is clearly marked as developer-preview/unavailable in packaged mode, or it can be hidden/disabled when the app detects it is packaged.

Recommended first behavior:

- In development: keep all three modes visible: This Mac, Remote URL, SSH Tunnel.
- In packaged Remote app mode: Remote URL remains enabled; This Mac is disabled with a concise message; SSH Tunnel remains enabled only if system `ssh` behavior is verified on the target Mac.

Rationale:

- Remote URL mode does not need bundled Next server assets.
- Remote URL mode avoids Prisma and `node-pty` packaging in the first `.app`.
- The user already has remote Orbit over Tailscale working.
- The first app delivers value without pretending full local packaging is solved.

## Packaging Tool

Use `electron-builder` for the first pass.

Reasons:

- It can generate macOS app targets directly.
- It supports unsigned local builds.
- It has documented macOS signing/notarization paths for later.
- Its config can keep the first target narrow while leaving room for future `dmg`/signed builds.

Initial target:

- `mac.target`: `dir` first.
- Optional follow-up target: `zip`.
- Avoid `dmg` until Finder launch and unsigned `.app` behavior are verified on the user's Mac.

## Proposed Package Scripts

Add scripts similar to:

```json
{
  "desktop:pack:remote": "npm run desktop:build && electron-builder --mac dir --config electron-builder.remote.yml",
  "desktop:pack:remote:zip": "npm run desktop:build && electron-builder --mac zip --config electron-builder.remote.yml"
}
```

Keep `desktop:pack` absent until the project has one clearly supported packaging profile. If a generic `desktop:pack` is later added, it should point to the verified remote profile, not to local server packaging.

## Proposed Builder Config

Add `electron-builder.remote.yml`:

```yaml
appId: app.orbit.desktop
productName: Orbit
files:
  - electron/**/*
  - package.json
extraMetadata:
  main: electron/bootstrap.cjs
mac:
  target:
    - target: dir
      arch:
        - arm64
  category: public.app-category.developer-tools
  hardenedRuntime: false
  gatekeeperAssess: false
  identity: null
asar: true
```

Notes:

- `identity: null` keeps the first app unsigned.
- `npmRebuild: false` keeps this Remote URL shell from trying to rebuild unrelated native server dependencies such as SSH/native modules.
- The packaged `app` directory is the compiled `dist-electron/` output with a generated minimal `package.json`, so root web/server dependencies are not bundled into the Remote URL shell.
- `files` should be kept minimal because Remote URL mode does not need bundled server assets.
- If `electron-builder` needs compiled Electron TypeScript output rather than source files, add a small build step that emits Electron files into `dist-electron/` and package that directory instead.
- Do not add `asarUnpack` for `node-pty` or Prisma in this phase unless local packaged server support is implemented.

## Runtime Behavior

Add a packaged-mode gate:

- Detect packaged app with `app.isPackaged`.
- If packaged and no packaged server runtime exists, disable `This Mac`.
- Show a short safe message: `This packaged preview connects to a remote Orbit server. Local This Mac packaging is not enabled yet.`
- Keep Remote URL as the primary path.

Do not silently fall back to repo paths in packaged mode.

## Profile and Token Model

Keep the existing Team B contract:

- Profiles may store endpoint/tunnel metadata.
- Profiles must not store access tokens.
- Access tokens are entered per connection attempt.
- Token-like URL query parameters remain rejected.
- Diagnostic text must not include raw token-bearing URLs.

Keychain storage is a separate future feature.

## Verification Plan

Linux/dev verification:

1. `npm run desktop:typecheck`
2. `npm run desktop:smoke`
3. `npm run desktop:package-smoke`
4. `npm run desktop:pack:remote` if the local OS/tooling supports the selected target

Mac verification:

1. Build or copy the branch to the MacBook.
2. Run `npm ci`.
3. Run `npm run desktop:pack:remote`.
4. Open `dist/mac-arm64/Orbit.app` or equivalent from Finder.
5. Confirm the picker opens.
6. Confirm Remote URL connect succeeds against the Tailscale Orbit server.
7. Confirm profile JSON does not contain tokens.
8. Confirm closing/reopening the app preserves the saved Remote URL profile but requires token re-entry.
9. Confirm This Mac is disabled or clearly marked unavailable in packaged mode.

## Evaluation Feedback

### Finding 1: The first draft was too close to generic packaging.

If the first implementation adds a generic `desktop:pack`, users may assume This Mac packaged local server support works. That would conflict with known unsolved Prisma, Next standalone, and `node-pty` packaging risks.

Resolution: Use `desktop:pack:remote` first and keep `desktop:pack` absent until the supported packaging profile is explicit.

### Finding 2: Packaging source Electron TypeScript directly may be fragile.

Electron currently runs through `electron/bootstrap.cjs`, and TypeScript loading behavior must be verified in packaged mode.

Resolution: Implementation must test whether packaging source files works. If not, add a dedicated Electron build output directory such as `dist-electron/` and package compiled JavaScript.

### Finding 3: This Mac should not fail with a confusing packaged runtime error.

If a packaged user clicks This Mac and it tries repo-preview startup, it may fail with an unclear missing repo/server path.

Resolution: Add an `app.isPackaged` gate that disables or clearly blocks This Mac until packaged server resources are implemented.

### Finding 4: Unsigned app distribution has macOS friction.

Unsigned `.app` builds may trigger Gatekeeper warnings on another Mac.

Resolution: Treat unsigned `.app` as a personal/local developer artifact only. Signing and notarization remain a separate follow-up after functionality is verified.

## Final Design

The next implementation should ship a Remote URL first unsigned macOS app package:

- Add `electron-builder`.
- Add `electron-builder.remote.yml`.
- Add `desktop:pack:remote`.
- Keep `desktop:pack` absent.
- Package only Electron shell assets needed for Remote URL.
- Detect packaged mode and disable/block This Mac local server mode.
- Preserve session-only token handling.
- Extend smoke checks to enforce the Remote URL first packaging boundary.
- Verify on the MacBook by opening the generated `.app` and connecting to the existing Tailscale Orbit server.
