#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  accessSync,
  chmodSync,
  constants as fsConstants,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function printHelp() {
  console.log(`Orbit CLI

Usage:
  orbit start server [--tailnet] [--production] [--skip-db] [--port <port>]
  orbit install mac-app [--local|--remote] [--open] [--install-dir <dir>] [--no-copy]
  orbit access-code <show|set|rotate> [value]

Examples:
  orbit start server
  orbit start server --tailnet
  orbit install mac-app
  orbit install mac-app --remote --open
`);
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? "inherit",
    shell: false,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function valueAfter(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function databaseEnv() {
  const configured = process.env.DATABASE_URL?.trim();
  return {
    DATABASE_URL: configured || "file:./orbit.db",
  };
}

function ensureDatabase() {
  run(npxCommand, ["prisma", "generate"], { env: databaseEnv() });
  run(npxCommand, ["prisma", "db", "push"], { env: databaseEnv() });
}

function startServer(args) {
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    console.log(`Usage:
  orbit start server [--tailnet] [--production] [--skip-db] [--port <port>]

Options:
  --tailnet      Start in Tailscale remote-access mode.
  --production  Build first, then run the production server.
  --skip-db     Skip Prisma generate/db push.
  --port <port> Set PORT for this run.
`);
    return;
  }

  const env = databaseEnv();
  const port = valueAfter(args, "--port");
  if (port) env.PORT = port;

  if (!hasFlag(args, "--skip-db")) {
    ensureDatabase();
  }

  if (hasFlag(args, "--tailnet")) {
    run(npmCommand, ["run", "dev:tailnet"], { env });
    return;
  }

  if (hasFlag(args, "--production")) {
    run(npmCommand, ["run", "build"], { env });
    run(npmCommand, ["run", "start"], { env });
    return;
  }

  run(npmCommand, ["run", "dev"], { env });
}

function ensureMac() {
  if (process.platform !== "darwin") {
    fail("orbit install mac-app can only build/install a Mac app on macOS.");
  }
}

function findBuiltApp(outputDir) {
  if (!existsSync(outputDir)) return null;
  const candidates = [];
  const stack = [outputDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const info = statSync(current);
    if (!info.isDirectory()) continue;
    if (current.endsWith(".app")) {
      candidates.push(current);
      continue;
    }
    for (const entry of readdirSync(current)) {
      stack.push(join(current, entry));
    }
  }
  candidates.sort();
  return candidates[0] ?? null;
}

function copyApp(appPath, installDir) {
  mkdirSync(installDir, { recursive: true });
  const target = join(installDir, basename(appPath));
  rmSync(target, { recursive: true, force: true });
  cpSync(appPath, target, { recursive: true });
  return target;
}

function defaultInstallDir() {
  try {
    mkdirSync("/Applications", { recursive: true });
    accessSync("/Applications", fsConstants.W_OK);
    return "/Applications";
  } catch {
    return join(homedir(), "Applications");
  }
}

function installMacApp(args) {
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    console.log(`Usage:
  orbit install mac-app [--local|--remote] [--open] [--install-dir <dir>] [--no-copy]

Options:
  --local              Build the self-hosted local Mac app. Default.
  --remote             Build the lightweight remote URL Mac app.
  --open               Open the installed app after copying.
  --install-dir <dir>  Install destination. Default: /Applications, then ~/Applications fallback.
  --no-copy            Build only; leave the .app under dist-packaged*.
`);
    return;
  }

  ensureMac();

  const mode = hasFlag(args, "--remote") ? "remote" : "local";
  const script = mode === "remote" ? "desktop:pack:remote" : "desktop:pack:local";
  run(npmCommand, ["run", script], { env: databaseEnv() });

  const outputDir = mode === "remote" ? "dist-packaged" : "dist-packaged-local";
  const appPath = findBuiltApp(join(root, outputDir));
  if (!appPath) fail(`Could not find built Orbit.app under ${outputDir}`);

  if (hasFlag(args, "--no-copy")) {
    console.log(`Built app: ${appPath}`);
    return;
  }

  const requestedDir = valueAfter(args, "--install-dir");
  const installDir = requestedDir ? resolve(requestedDir) : defaultInstallDir();
  const installedPath = copyApp(appPath, installDir);
  console.log(`Installed Orbit app: ${installedPath}`);

  if (hasFlag(args, "--open")) {
    run("open", [installedPath]);
  }
}

function accessCode(args) {
  run("bash", [join(root, "scripts", "access-code.sh"), ...args]);
}

function main() {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "start" && subcommand === "server") {
    startServer(rest);
    return;
  }

  if (command === "install" && subcommand === "mac-app") {
    installMacApp(rest);
    return;
  }

  if (command === "access-code") {
    accessCode([subcommand, ...rest].filter(Boolean));
    return;
  }

  fail(`Unknown command: ${[command, subcommand, ...rest].filter(Boolean).join(" ")}\nRun: orbit --help`);
}

try {
  chmodSync(fileURLToPath(import.meta.url), 0o755);
} catch {
  // Best effort for source checkouts; npm also preserves bin executability.
}

main();
