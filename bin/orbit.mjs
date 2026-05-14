#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  accessSync,
  chmodSync,
  constants as fsConstants,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
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
  orbit doctor [--port <port>]

Examples:
  orbit start server
  orbit start server --tailnet
  orbit install mac-app
  orbit install mac-app --remote --open
  orbit doctor
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

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const parsed = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      trimmed,
    );
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1) value = value.slice(0, commentIndex).trim();
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

function projectEnv() {
  return {
    ...parseEnvFile(join(root, ".env")),
    ...parseEnvFile(join(root, ".env.local")),
  };
}

function databaseEnv() {
  const configured =
    process.env.DATABASE_URL?.trim() || projectEnv().DATABASE_URL?.trim();
  return {
    DATABASE_URL: configured || "file:./orbit.db",
  };
}

function databaseSource() {
  if (process.env.DATABASE_URL?.trim()) return "shell";
  if (projectEnv().DATABASE_URL?.trim()) return ".env";
  return "default";
}

function safeDatabaseUrlForLog(databaseUrl) {
  if (databaseUrl.startsWith("file:")) return databaseUrl;
  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = "****";
    return url.toString();
  } catch {
    return "<configured>";
  }
}

function ensureDatabase(env) {
  run(npxCommand, ["prisma", "generate"], { env });
  run(npxCommand, ["prisma", "db", "push"], { env });
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

  console.log(
    `Orbit server database: ${safeDatabaseUrlForLog(env.DATABASE_URL)} (${databaseSource()})`,
  );
  if (env.PORT) console.log(`Orbit server port: ${env.PORT}`);

  if (!hasFlag(args, "--skip-db")) {
    ensureDatabase(env);
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

function commandVersion(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) return null;
  return (result.stdout || result.stderr || "").trim().split("\n")[0] || "ok";
}

function commandPath(command) {
  const lookupCommand = process.platform === "win32" ? "where" : "sh";
  const lookupArgs =
    process.platform === "win32" ? [command] : ["-lc", `command -v ${command}`];
  const result = spawnSync(lookupCommand, lookupArgs, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim().split("\n")[0] || null;
}

function checkPort(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function sqlitePathFromDatabaseUrl(databaseUrl) {
  const value = databaseUrl?.trim() || "file:./orbit.db";
  if (!value.startsWith("file:")) return null;
  const rawPath = value.slice("file:".length);
  return isAbsolute(rawPath) ? rawPath : resolve(root, "prisma", rawPath);
}

function packageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}

function printCheck(label, ok, detail, fix) {
  const icon = ok ? "OK" : "WARN";
  console.log(`[${icon}] ${label}${detail ? ` - ${detail}` : ""}`);
  if (!ok && fix) console.log(`      fix: ${fix}`);
}

async function doctor(args) {
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    console.log(`Usage:
  orbit doctor [--port <port>]

Checks the local Orbit source checkout, Mac app prerequisites, database,
access code, ports, and agent CLI availability without changing files.
`);
    return;
  }

  const port = Number(valueAfter(args, "--port") ?? process.env.PORT ?? 3000);
  const databaseUrl = databaseEnv().DATABASE_URL;
  const sqlitePath = sqlitePathFromDatabaseUrl(databaseUrl);
  const nodeVersion = commandVersion(process.execPath, ["--version"]);
  const npmVersion = commandVersion(npmCommand, ["--version"]);
  const npxVersion = commandVersion(npxCommand, ["--version"]);
  const packageJson = existsSync(join(root, "package.json"));
  const nodeModules = existsSync(join(root, "node_modules"));
  const prismaSchema = existsSync(join(root, "prisma", "schema.prisma"));
  const prismaClient =
    existsSync(join(root, "node_modules", ".prisma", "client")) &&
    existsSync(join(root, "node_modules", "@prisma", "client"));
  const nextBuild = existsSync(join(root, ".next", "BUILD_ID"));
  const distServer = existsSync(join(root, "dist", "server.js"));
  const accessCodeFile = existsSync(join(homedir(), ".orbit", "access-token"));
  const dbExists = sqlitePath ? existsSync(sqlitePath) : false;
  const dbDirExists = sqlitePath ? existsSync(dirname(sqlitePath)) : false;
  const portOpen = Number.isSafeInteger(port)
    ? await checkPort("127.0.0.1", port)
    : false;
  const localApp = findBuiltApp(join(root, "dist-packaged-local"));
  const remoteApp = findBuiltApp(join(root, "dist-packaged"));

  console.log(`Orbit doctor (${packageVersion()})`);
  console.log(`Root: ${root}`);
  console.log(`Database source: ${databaseSource()}`);
  console.log("");

  printCheck("Node", Boolean(nodeVersion), nodeVersion ?? "not found");
  printCheck("npm", Boolean(npmVersion), npmVersion ?? "not found");
  printCheck("npx", Boolean(npxVersion), npxVersion ?? "not found");
  printCheck("package.json", packageJson, packageJson ? "found" : "missing");
  printCheck(
    "Dependencies",
    nodeModules,
    nodeModules ? "node_modules found" : "node_modules missing",
    "npm install",
  );
  printCheck(
    "Prisma schema",
    prismaSchema,
    prismaSchema ? "found" : "missing",
  );
  printCheck(
    "Prisma client",
    prismaClient,
    prismaClient ? "generated" : "missing",
    "npx prisma generate",
  );
  printCheck(
    "Database URL",
    Boolean(sqlitePath),
    sqlitePath ? `${databaseUrl} -> ${sqlitePath}` : databaseUrl,
  );
  printCheck(
    "Database directory",
    dbDirExists,
    sqlitePath && dbDirExists ? dirname(sqlitePath) : "missing",
    sqlitePath ? `mkdir -p "${dirname(sqlitePath)}"` : undefined,
  );
  printCheck(
    "Database file",
    dbExists,
    dbExists ? sqlitePath : "not created yet",
    "orbit start server",
  );
  printCheck(
    "Access code",
    accessCodeFile,
    accessCodeFile ? "~/.orbit/access-token exists" : "not configured",
    "orbit access-code rotate",
  );
  printCheck(
    `Port ${port}`,
    !portOpen,
    portOpen ? "already in use" : "available",
    portOpen ? `PORT=<other-port> orbit start server` : undefined,
  );
  printCheck(
    "Next production build",
    nextBuild,
    nextBuild ? ".next/BUILD_ID found" : "missing",
    "npm run build",
  );
  printCheck(
    "Packaged server bundle",
    distServer,
    distServer ? "dist/server.js found" : "missing",
    "orbit install mac-app",
  );
  printCheck(
    "Local Mac app build",
    Boolean(localApp),
    localApp ?? "not built",
    "orbit install mac-app",
  );
  printCheck(
    "Remote Mac app build",
    Boolean(remoteApp),
    remoteApp ?? "not built",
    "orbit install mac-app --remote",
  );

  console.log("");
  for (const command of ["claude", "codex", "opencode"]) {
    const found = commandPath(command);
    printCheck(
      `${command} CLI`,
      Boolean(found),
      found ?? "not found in PATH",
      `Install ${command} or add it to your login shell PATH`,
    );
  }

  console.log("");
  console.log("Useful commands:");
  console.log("  orbit start server");
  console.log("  orbit start server --tailnet");
  console.log("  orbit install mac-app --open");
  console.log("  orbit access-code show");
}

async function main() {
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

  if (command === "doctor") {
    await doctor([subcommand, ...rest].filter(Boolean));
    return;
  }

  fail(`Unknown command: ${[command, subcommand, ...rest].filter(Boolean).join(" ")}\nRun: orbit --help`);
}

try {
  chmodSync(fileURLToPath(import.meta.url), 0o755);
} catch {
  // Best effort for source checkouts; npm also preserves bin executability.
}

await main();
