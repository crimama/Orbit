#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") {
  console.log("desktop-rebuild-local-native: skipped outside macOS");
  process.exit(0);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["electron-rebuild", "-f", "-w", "node-pty"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
