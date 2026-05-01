#!/usr/bin/env node
import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm("dist", { recursive: true, force: true });
run("npx", ["prisma", "generate"]);
run("npx", ["tsc", "-p", "tsconfig.server.json"]);

await mkdir("dist/node_modules/@", { recursive: true });
await cp("dist/src/server", "dist/node_modules/@/server", {
  recursive: true,
});
await cp("dist/src/lib", "dist/node_modules/@/lib", { recursive: true });
