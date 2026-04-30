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
requireFile("tsconfig.electron.json");
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
