#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const exists = (path) => existsSync(resolve(root, path));
const has = (path, pattern) => exists(path) && pattern.test(read(path));

const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts ?? {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

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
    id: 'local-server-supervisor',
    label: 'Local mode starts and supervises an embedded loopback Orbit server',
    pass:
      exists('electron/serverSupervisor.ts') &&
      has('electron/serverSupervisor.ts', /spawn\s*\(/) &&
      has('electron/serverSupervisor.ts', /ORBIT_DESKTOP_LOCAL/) &&
      has('electron/serverSupervisor.ts', /127\.0\.0\.1/) &&
      has('electron/serverSupervisor.ts', /DATABASE_URL/) &&
      has('electron/serverSupervisor.ts', /readiness|ready|fetch|http/i),
    gap: 'Add an Electron server supervisor that spawns Orbit on 127.0.0.1 with desktop env/appData and waits for HTTP readiness.',
  },
  {
    id: 'remote-preload-isolation',
    label: 'Remote URL pages do not receive privileged desktop preload APIs',
    pass:
      has('electron/main.ts', /remote[^]*preload\s*:\s*(undefined|false)/i) ||
      has('electron/main.ts', /withoutPreload|unprivileged/i),
    gap: 'Create/load remote URL content without the privileged preload bridge; IPC origin checks alone still expose window.orbitDesktop to remote pages.',
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

const failures = checks.filter((check) => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.id}: ${check.label}`);
  if (!check.pass) console.log(`  gap: ${check.gap}`);
}
console.log(`\nDesktop smoke summary: ${checks.length - failures.length}/${checks.length} passed`);

if (failures.length) {
  console.log('\nConcrete gaps:');
  for (const failure of failures) console.log(`- ${failure.id}: ${failure.gap}`);
  process.exitCode = 1;
}
