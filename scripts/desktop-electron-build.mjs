#!/usr/bin/env node
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm("dist-electron", { recursive: true, force: true });
await mkdir("dist-electron", { recursive: true });

run("npx", ["tsc", "-p", "tsconfig.electron-build.json"]);

await cp("electron/connection.html", "dist-electron/connection.html");
await cp("electron/preload.cjs", "dist-electron/preload.cjs");
await writeFile(
  "dist-electron/package.json",
  `${JSON.stringify(
    {
      name: "agent-orbit-desktop-remote",
      version: "0.1.0",
      private: true,
      main: "main.js",
    },
    null,
    2,
  )}\n`,
);
