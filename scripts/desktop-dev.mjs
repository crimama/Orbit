#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const databasePath = join(tmpdir(), "orbit-mac-desktop-build.db");
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL?.trim() || `file:${databasePath}`,
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

mkdirSync(tmpdir(), { recursive: true });
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
run(process.platform === "win32" ? "npx.cmd" : "npx", ["electron", "electron/bootstrap.cjs"]);
