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
