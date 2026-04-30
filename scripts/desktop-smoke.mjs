#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function exists(relativePath) {
  return existsSync(join(root, relativePath));
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function has(relativePath, pattern) {
  return exists(relativePath) && pattern.test(read(relativePath));
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const pkg = readJson("package.json");
const scripts = pkg.scripts ?? {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

const checks = [
  {
    id: "desktop-package-scripts",
    label:
      "package.json exposes desktop dev/build/preview/typecheck/smoke scripts",
    pass: [
      "desktop:dev",
      "desktop:build",
      "desktop:preview",
      "desktop:typecheck",
      "desktop:electron-build",
      "desktop:smoke",
      "desktop:package-smoke",
      "desktop:pack:remote",
      "desktop:pack:remote:zip",
    ].every((name) => typeof scripts[name] === "string"),
    gap: "Add the desktop scripts required by the Electron developer-preview workflow.",
  },
  {
    id: "packaging-claim-boundary",
    label: "Developer preview exposes only the remote packaged-app profile",
    pass:
      typeof scripts["desktop:pack"] !== "string" &&
      Boolean(deps["electron-builder"]) &&
      /desktop:electron-build/.test(scripts["desktop:pack:remote"] ?? "") &&
      /electron-builder/.test(scripts["desktop:pack:remote"] ?? "") &&
      exists("electron-builder.remote.yml"),
    gap: "Keep desktop:pack absent and expose only a real desktop:pack:remote script backed by electron-builder.remote.yml.",
  },
  {
    id: "electron-dependency",
    label: "Electron runtime dependency is declared",
    pass: Boolean(deps.electron),
    gap: "Declare Electron as a dependency or devDependency for the desktop shell.",
  },
  {
    id: "desktop-dev-build-prerequisite",
    label: "desktop:dev builds Next before starting Electron local mode",
    pass:
      /desktop-dev\.mjs/.test(scripts["desktop:dev"] ?? "") &&
      has("scripts/desktop-dev.mjs", /DATABASE_URL/) &&
      has("scripts/desktop-dev.mjs", /npm[\s\S]*run[\s\S]*build/) &&
      has("scripts/desktop-dev.mjs", /electron\/bootstrap\.cjs/),
    gap: "Run next build before Electron so This Mac production child server can find .next/BUILD_ID.",
  },
  {
    id: "desktop-script-chain",
    label:
      "desktop build/preview scripts keep the developer-preview validation chain",
    pass:
      /desktop:typecheck/.test(scripts["desktop:build"] ?? "") &&
      /desktop:smoke/.test(scripts["desktop:build"] ?? "") &&
      /desktop:package-smoke/.test(scripts["desktop:build"] ?? "") &&
      /npm run build/.test(scripts["desktop:preview"] ?? "") &&
      /desktop:build/.test(scripts["desktop:preview"] ?? "") &&
      !/desktop:preview/.test(scripts["desktop:dev"] ?? ""),
    gap: "Keep desktop:build as typecheck+smoke+package-smoke, desktop:preview as Next build plus desktop:build, and desktop:dev as the launcher path.",
  },
  {
    id: "electron-shell-files",
    label: "Electron main, preload, and connection picker files exist",
    pass: [
      "electron/main.ts",
      "electron/preload.ts",
      "electron/preload.cjs",
      "electron/connection.html",
    ].every(exists),
    gap: "Create the Electron main/preload bridge and file-based connection picker.",
  },
  {
    id: "browser-window-hardening",
    label: "BrowserWindow uses hardened webPreferences",
    pass:
      has("electron/main.ts", /nodeIntegration\s*:\s*false/) &&
      has("electron/main.ts", /contextIsolation\s*:\s*true/) &&
      has("electron/main.ts", /sandbox\s*:\s*true/),
    gap: "Set nodeIntegration:false, contextIsolation:true, and sandbox:true.",
  },
  {
    id: "remote-preload-isolation",
    label:
      "Remote Orbit content is loaded without the privileged preload bridge",
    pass:
      has("electron/main.ts", /preload:\s*mode\s*===\s*"picker"/) ||
      (has("electron/main.ts", /createWindow\([^)]*picker/) &&
        has("electron/main.ts", /preload:\s*undefined/)),
    gap: "Use a picker-only preload window or another equivalent path so remote pages do not receive window.orbitDesktop.",
  },
  {
    id: "navigation-guardrails",
    label: "Main process blocks unexpected navigation and window opens",
    pass:
      has("electron/main.ts", /setWindowOpenHandler/) &&
      has("electron/main.ts", /will-navigate/) &&
      has("electron/main.ts", /openExternal/) &&
      has("electron/main.ts", /preventDefault/),
    gap: "Add navigation and window.open guardrails, opening external links in the OS browser.",
  },
  {
    id: "local-server-supervisor",
    label: "Local mode starts and supervises an embedded loopback Orbit server",
    pass:
      exists("electron/serverSupervisor.ts") &&
      has("electron/serverSupervisor.ts", /spawn\s*\(/) &&
      has("electron/serverSupervisor.ts", /resolveNodeBinary/) &&
      has("electron/serverSupervisor.ts", /repo-preview/) &&
      has("electron/serverSupervisor.ts", /packaged-resources/) &&
      has("electron/serverSupervisor.ts", /ORBIT_DESKTOP_LOCAL/) &&
      has("electron/serverSupervisor.ts", /DATABASE_URL/) &&
      has("electron/serverSupervisor.ts", /desktop-db-bootstrap/),
    gap: "Add a local server supervisor with appData DATABASE_URL, ORBIT_DESKTOP_LOCAL, DB bootstrap, readiness handling, and an explicit preview-vs-packaged runtime boundary.",
  },
  {
    id: "connection-profile-modules",
    label: "Connection profile, URL validation, and tunnel modules exist",
    pass: [
      "electron/profileStore.ts",
      "electron/urlValidation.ts",
      "electron/tunnel.ts",
    ].every(exists),
    gap: "Add profileStore/urlValidation/tunnel modules for local, remote, and SSH tunnel profiles.",
  },
  {
    id: "packaged-remote-only-gate",
    label:
      "Packaged app blocks local/SSH modes until packaged runtime support exists",
    pass:
      has("electron/main.ts", /isRemoteOnlyPackagedApp/) &&
      has("electron/main.ts", /desktopCapabilities/) &&
      has("electron/main.ts", /PACKAGED_REMOTE_ONLY/) &&
      has("electron/types.ts", /OrbitDesktopCapabilities/) &&
      has("electron/preload.ts", /getCapabilities/) &&
      has("electron/connection.html", /Remote URL packaged preview/) &&
      has("electron/connection.html", /\.card\.disabled/),
    gap: "Add an app.isPackaged gate, capabilities IPC, disabled picker state, and PACKAGED_REMOTE_ONLY diagnostic.",
  },
  {
    id: "ssh-argv-safety",
    label:
      "SSH tunnel implementation uses argv spawning with safe forwarding options",
    pass:
      has("electron/tunnel.ts", /spawn\s*\(/) &&
      has("electron/tunnel.ts", /shell:\s*false/) &&
      has("electron/tunnel.ts", /ExitOnForwardFailure=yes/) &&
      has("electron/tunnel.ts", /ServerAliveInterval=30/) &&
      !has("electron/tunnel.ts", /exec\s*\(/),
    gap: "Use child_process.spawn with argv, ExitOnForwardFailure, ServerAliveInterval, and no shell interpolation.",
  },
  {
    id: "desktop-local-auth",
    label: "Server has ORBIT_DESKTOP_LOCAL loopback cookie handling",
    pass:
      has("server.ts", /ORBIT_DESKTOP_LOCAL/) &&
      has("server.ts", /isDesktopLocalHttpRequest|desktopLocal/i),
    gap: "Add loopback-only ORBIT_DESKTOP_LOCAL cookie relaxation/token support.",
  },
  {
    id: "dynamic-project-registry-api",
    label:
      "Project registry API is excluded from build-time prerender DB access",
    pass: has(
      "src/app/api/resources/projects/registry/route.ts",
      /dynamic\s*=\s*["']force-dynamic["']/,
    ),
    gap: "Mark the registry API route force-dynamic so next build does not query Prisma without a runtime database.",
  },
  {
    id: "session-only-desktop-secrets",
    label:
      "Desktop local access token is session-only unless Keychain support exists",
    pass:
      has("electron/serverSupervisor.ts", /createSessionAccessToken/) &&
      has("electron/serverSupervisor.ts", /ORBIT_DESKTOP_SESSION_ONLY_AUTH/) &&
      has(
        "src/server/auth/accessTokenStore.ts",
        /ORBIT_DESKTOP_SESSION_ONLY_AUTH/,
      ) &&
      !has("electron/serverSupervisor.ts", /writeFileSync|accessTokenFile/),
    gap: "Do not persist generated desktop access tokens as plaintext app-data files.",
  },
  {
    id: "remote-session-token",
    label:
      "Remote/tunnel access tokens are session-only and not saved in profiles",
    pass:
      has("electron/main.ts", /sessionAccessToken/) &&
      has("electron/main.ts", /appendOneShotToken/) &&
      has("electron/main.ts", /delete profile\.sessionAccessToken/) &&
      has("electron/main.ts", /withoutOneShotToken/) &&
      has("electron/main.ts", /redactConnectionError/) &&
      has("electron/main.ts", /safeConnectionFailureStatus/) &&
      has("electron/urlValidation.ts", /TOKEN_QUERY_KEYS/) &&
      has("electron/connection.html", /not saved/) &&
      !has("electron/profileStore.ts", /tokenKey/) &&
      !has("electron/main.ts", /_sessionAccessToken/),
    gap: "Keep remote/tunnel tokens out of profile JSON and pass optional tokens only for the active connection.",
  },

  {
    id: "safe-connection-diagnostics",
    label:
      "Remote/tunnel failures produce useful diagnostics without token values",
    pass:
      has("electron/main.ts", /safeConnectionFailureStatus/) &&
      has("electron/main.ts", /diagnosticCode/) &&
      has("electron/main.ts", /Session tokens are never saved/) &&
      has("electron/main.ts", /\[redacted\]/) &&
      has("electron/types.ts", /diagnostic\?: string/) &&
      has("electron/connection.html", /safe network\/TLS hints/) &&
      has("electron/connection.html", /safe SSH\/port-forward hints/) &&
      has("electron/connection.html", /setStatusFromResult/),
    gap: "Add safe remote/tunnel failure diagnostics and redact token-bearing values before surfacing errors.",
  },

  {
    id: "remote-url-token-query-rejected",
    label: "Remote URL validation rejects token-like query parameters",
    pass:
      has("electron/urlValidation.ts", /TOKEN_QUERY_KEYS/) &&
      has("electron/urlValidation.ts", /access_token/) &&
      has("electron/urlValidation.ts", /sessionaccesstoken/) &&
      has(
        "electron/urlValidation.ts",
        /Access tokens must be entered in the session-only token field/,
      ),
    gap: "Reject token-like query parameters before remote URLs can be persisted in profiles.",
  },

  {
    id: "db-bootstrap",
    label: "Desktop first-run database bootstrap is explicit",
    pass:
      exists("scripts/desktop-db-bootstrap.mjs") &&
      has("scripts/desktop-db-bootstrap.mjs", /prisma[\s\S]*db[\s\S]*push/),
    gap: "Add an appData DATABASE_URL bootstrap step instead of relying on prisma/dev.db.",
  },
  {
    id: "notarization-claim-boundary",
    label:
      "Repository does not claim notarized desktop support without packaging proof",
    pass:
      has(
        "docs/orbit-mac-electron-design.md",
        /do not pretend it is packaged or notarized/i,
      ) &&
      has(
        "docs/orbit-mac-electron-design.md",
        /Developer ID notarization later/i,
      ) &&
      !Object.entries(scripts).some(
        ([name, value]) => /notar/i.test(name) || /notar/i.test(String(value)),
      ),
    gap: "Keep notarization described as unverified follow-up unless a real packaging/notarization script and proof are added.",
  },
  {
    id: "packaging-risk-docs",
    label:
      "Documentation records packaging, notarization, native rebuild, and Prisma risks",
    pass:
      has("docs/orbit-mac-electron-design.md", /notarization/i) &&
      has("docs/orbit-mac-electron-design.md", /node-pty/i) &&
      has("docs/orbit-mac-electron-design.md", /Prisma/i) &&
      has("docs/orbit-mac-packaging-design.md", /Linux CI/i) &&
      has("docs/orbit-mac-packaging-design.md", /Electron ABI/i) &&
      has(
        "docs/orbit-mac-remote-app-packaging-plan.md",
        /Remote URL first unsigned macOS app package/i,
      ),
    gap: "Document remaining packaging/notarization/native-module/Prisma risks.",
  },
];

const failures = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.id}: ${check.label}`);
  if (!check.pass) console.log(`  gap: ${check.gap}`);
}

console.log(
  `\nDesktop smoke summary: ${checks.length - failures.length}/${checks.length} passed`,
);

if (failures.length) {
  console.log("\nConcrete gaps:");
  for (const failure of failures)
    console.log(`- ${failure.id}: ${failure.gap}`);
  process.exit(1);
}
