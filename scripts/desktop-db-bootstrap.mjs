#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function databasePathFromUrl(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) return null;
  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath || rawPath === ":memory:") return null;
  return rawPath;
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("desktop-db-bootstrap: DATABASE_URL is required");
  process.exit(1);
}

const databasePath = databasePathFromUrl(databaseUrl);
if (databasePath) mkdirSync(dirname(databasePath), { recursive: true });

const root = fileURLToPath(new URL("..", import.meta.url));
const localPrismaCli = join(
  root,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);
const command = existsSync(localPrismaCli)
  ? process.execPath
  : process.platform === "win32"
    ? "npx.cmd"
    : "npx";
const args = existsSync(localPrismaCli)
  ? [
      localPrismaCli,
      "db",
      "push",
      "--skip-generate",
      "--schema",
      "prisma/schema.prisma",
    ]
  : [
      "prisma",
      "db",
      "push",
      "--skip-generate",
      "--schema",
      "prisma/schema.prisma",
    ];

const result = spawnSync(command, args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
