#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function requireFile(relativePath) {
  if (!existsSync(join(root, relativePath))) failures.push(`missing ${relativePath}`);
}

function requireScript(scripts, name) {
  if (!scripts?.[name]) failures.push(`package.json missing script ${name}`);
}

<<<<<<< HEAD
const checks = [
  {
    id: 'desktop-package-scripts',
    label: 'package.json exposes desktop:dev, desktop:build, and desktop:pack scripts',
    pass: ['desktop:dev', 'desktop:build', 'desktop:pack'].every((name) => typeof scripts[name] === 'string'),
    gap: 'Add Electron desktop scripts before claiming packaged app support.',
  },
  {
    id: 'electron-dependency',
    label: 'Electron runtime dependency is declared',
    pass: Boolean(deps.electron),
    gap: 'Declare Electron dependency/devDependency for the desktop shell.',
  },
  {
    id: 'electron-shell-files',
    label: 'Electron main, preload, and connection picker files exist',
    pass: ['electron/main.ts', 'electron/preload.ts', 'electron/connection.html'].every(exists),
    gap: 'Create electron/main.ts, electron/preload.ts, and electron/connection.html.',
  },
  {
    id: 'browser-window-hardening',
    label: 'BrowserWindow source includes hardened webPreferences',
    pass:
      has('electron/main.ts', /nodeIntegration\s*:\s*false/) &&
      has('electron/main.ts', /contextIsolation\s*:\s*true/) &&
      has('electron/main.ts', /sandbox\s*:\s*true/),
    gap: 'Set nodeIntegration:false, contextIsolation:true, and sandbox:true for app windows.',
  },
  {
    id: 'navigation-guardrails',
    label: 'Main process blocks unexpected navigation/window opens',
    pass:
      has('electron/main.ts', /will-navigate|setWindowOpenHandler/) &&
      has('electron/main.ts', /openExternal|preventDefault/),
    gap: 'Add navigation and window.open guardrails, opening external links in the OS browser.',
  },
  {
    id: 'connection-profile-modules',
    label: 'Connection profile, URL validation, and tunnel modules exist',
    pass: ['electron/profileStore.ts', 'electron/urlValidation.ts', 'electron/tunnel.ts'].every(exists),
    gap: 'Add profileStore/urlValidation/tunnel modules for local, remote, and SSH tunnel profiles.',
  },
  {
    id: 'ssh-argv-safety',
    label: 'SSH tunnel implementation uses argv spawning with safe forwarding options',
    pass:
      has('electron/tunnel.ts', /spawn\s*\(/) &&
      has('electron/tunnel.ts', /ExitOnForwardFailure=yes/) &&
      has('electron/tunnel.ts', /ServerAliveInterval=30/) &&
      !has('electron/tunnel.ts', /exec\s*\(/),
    gap: 'Use child_process.spawn with argv, ExitOnForwardFailure, ServerAliveInterval, and no shell interpolation.',
  },
  {
    id: 'desktop-local-auth',
    label: 'Server has ORBIT_DESKTOP_LOCAL loopback cookie/auth handling',
    pass: has('server.ts', /ORBIT_DESKTOP_LOCAL/) && has('server.ts', /127\.0\.0\.1|localhost|loopback/i),
    gap: 'Add loopback-only ORBIT_DESKTOP_LOCAL cookie relaxation/token bootstrap support.',
  },
  {
    id: 'db-bootstrap',
    label: 'Desktop first-run database bootstrap is explicit',
    pass: exists('scripts/desktop-db-bootstrap.mjs') || has('electron/serverSupervisor.ts', /prisma\s+db\s+push|migrate\s+deploy|db\s+push/),
    gap: 'Add an appData DATABASE_URL bootstrap step instead of relying on prisma/dev.db.',
  },
  {
    id: 'packaging-risk-docs',
    label: 'Documentation records packaging, notarization, native rebuild, and Prisma risks',
    pass:
      has('docs/orbit-mac-electron-design.md', /notarization/i) &&
      has('docs/orbit-mac-electron-design.md', /node-pty/i) &&
      has('docs/orbit-mac-electron-design.md', /Prisma/i),
    gap: 'Document remaining packaging/notarization/native-module/Prisma risks.',
  },
];
=======
function expectText(relativePath, pattern, description) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`missing ${relativePath} for ${description}`);
    return;
  }
  const content = readFileSync(join(root, relativePath), "utf8");
  if (!pattern.test(content)) failures.push(`${relativePath} missing ${description}`);
}

const pkg = readJson("package.json");
requireScript(pkg.scripts, "desktop:build");
requireScript(pkg.scripts, "desktop:typecheck");
requireScript(pkg.scripts, "desktop:smoke");
requireFile("tsconfig.desktop.json");
requireFile("docs/orbit-mac-electron-design.md");
expectText("docs/orbit-mac-electron-design.md", /desktop:build/i, "desktop build verification documentation");
expectText("docs/orbit-mac-electron-design.md", /notarization|native rebuild|Prisma/i, "packaging risk documentation");

const electronMainPath = join(root, "electron", "main.ts");
const electronPreloadPath = join(root, "electron", "preload.ts");
if (existsSync(electronMainPath)) {
  const main = readFileSync(electronMainPath, "utf8");
  const securityChecks = [
    [/(nodeIntegration\s*:\s*false|nodeIntegration:\s*false)/, "nodeIntegration disabled"],
    [/(contextIsolation\s*:\s*true|contextIsolation:\s*true)/, "contextIsolation enabled"],
    [/(shell\s*:\s*false|spawn\([^\n]+,\s*[^\n]+,\s*\{[^}]*shell:\s*false)/s, "child processes avoid shell interpolation"],
    [/(setWindowOpenHandler|will-navigate|web-contents-created)/, "unexpected navigation/window-open handling"],
  ];
  for (const [pattern, description] of securityChecks) {
    if (!pattern.test(main)) failures.push(`electron/main.ts missing ${description}`);
  }
} else {
  warnings.push("electron/main.ts not present; desktop smoke limited to scripts/config/docs in this worktree.");
}
>>>>>>> main

if (existsSync(electronPreloadPath)) {
  const preload = readFileSync(electronPreloadPath, "utf8");
  if (!/contextBridge\.(exposeInMainWorld|exposeInIsolatedWorld)/.test(preload)) {
    failures.push("electron/preload.ts missing contextBridge exposure");
  }
} else {
  warnings.push("electron/preload.ts not present; preload smoke deferred until shell lane is integrated.");
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (failures.length) {
  console.error("desktop smoke FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("desktop smoke PASS");
