#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const electronMain = join(root, "electron", "main.ts");
const electronPreload = join(root, "electron", "preload.ts");

if (!existsSync(electronMain) && !existsSync(electronPreload)) {
  console.log("desktop:typecheck SKIP: electron/main.ts and electron/preload.ts are not present in this worktree yet.");
  process.exit(0);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "-p", "tsconfig.electron.json", "--noEmit", "--pretty", "false", "--incremental", "false"],
  { stdio: "inherit", cwd: root },
);

process.exit(result.status ?? 1);
