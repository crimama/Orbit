import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  type WriteStream,
} from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { join } from "node:path";

import {
  ensureOrbitDesktopPaths,
  type OrbitDesktopPaths,
} from "./desktopPaths.js";

export interface OrbitLocalServerOptions {
  appName?: string;
  cwd?: string;
  port?: number | "auto";
  readinessTimeoutMs?: number;
}

export interface OrbitLocalServerHandle {
  url: string;
  port: number;
  accessToken: string;
  paths: OrbitDesktopPaths;
  child: ChildProcess;
  stop: () => Promise<void>;
}

type OrbitServerRuntimeMode = "repo-preview" | "packaged-resources";

interface OrbitServerRuntimePlan {
  mode: OrbitServerRuntimeMode;
  cwd: string;
  command: string;
  args: string[];
  description: string;
}

class RecentOutputBuffer {
  private chunks: string[] = [];

  constructor(private readonly maxLength = 8_000) {}

  push(chunk: Buffer | string): void {
    this.chunks.push(chunk.toString());
    let text = this.chunks.join("");
    if (text.length > this.maxLength) {
      text = text.slice(text.length - this.maxLength);
      this.chunks = [text];
    }
  }

  text(): string {
    return this.chunks.join("").trim();
  }
}

function repoRootFromElectronDir(): string {
  return join(__dirname, "..");
}

async function pickPort(preferred: number | "auto" = "auto"): Promise<number> {
  if (typeof preferred === "number") return preferred;

  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Unable to allocate local desktop port"));
      });
    });
  });
}

function createSessionAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

function resolveNodeBinary(cwd: string): string {
  const explicit = process.env.ORBIT_DESKTOP_NODE_BINARY?.trim();
  if (explicit) return explicit;

  const bundledNode = join(
    cwd,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "node.cmd" : "node",
  );
  if (existsSync(bundledNode)) return bundledNode;

  return process.execPath;
}

function hasPackagedServerRuntime(cwd: string): boolean {
  return (
    existsSync(join(cwd, ".next", "BUILD_ID")) &&
    existsSync(join(cwd, "dist", "server.js")) &&
    existsSync(join(cwd, "scripts", "desktop-db-bootstrap.mjs")) &&
    existsSync(join(cwd, "prisma", "schema.prisma"))
  );
}

function resolveServerRuntimePlan(cwd: string): OrbitServerRuntimePlan {
  const requestedMode = process.env.ORBIT_DESKTOP_SERVER_RUNTIME?.trim();
  const nodeBinary = resolveNodeBinary(cwd);
  const packagedRuntimeAvailable = hasPackagedServerRuntime(cwd);

  if (
    requestedMode === "packaged-resources" ||
    (!requestedMode && packagedRuntimeAvailable)
  ) {
    const packagedServer = join(cwd, "dist", "server.js");
    return {
      mode: "packaged-resources",
      cwd,
      command: nodeBinary,
      args: [packagedServer],
      description:
        "Runs Orbit from packaged Electron app resources with compiled server assets.",
    };
  }

  if (!requestedMode || requestedMode === "repo-preview") {
    return {
      mode: "repo-preview",
      cwd,
      command: nodeBinary,
      args: ["--import", "tsx", join(cwd, "server.ts")],
      description:
        "Runs Orbit from the repository checkout for the Electron developer preview.",
    };
  }

  if (requestedMode !== "packaged-resources") {
    throw new Error(
      `Unsupported Orbit desktop server runtime: ${requestedMode}`,
    );
  }

  if (!packagedRuntimeAvailable) {
    throw new Error(
      "Packaged Orbit server runtime was requested, but .next, dist/server.js, scripts/desktop-db-bootstrap.mjs, or prisma/schema.prisma was not found. " +
        "Use repo-preview for desktop:dev, or provide packaged server assets before enabling packaged-resources.",
    );
  }

  throw new Error("Packaged Orbit server runtime could not be resolved.");
}

async function waitForHttpReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = httpRequest(
          url,
          { method: "GET", timeout: 1_000 },
          (res) => {
            res.resume();
            resolve();
          },
        );
        req.once("timeout", () => {
          req.destroy(new Error("HTTP readiness probe timed out"));
        });
        req.once("error", reject);
        req.end();
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(
    `Timed out waiting for Orbit desktop server readiness at ${url}: ${lastError?.message ?? "no response"}`,
  );
}

function spawnChecked(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  return spawn(command, args, {
    cwd,
    env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createSupervisorLog(paths: OrbitDesktopPaths): {
  path: string;
  stream: WriteStream;
} {
  const logDir = join(paths.appDataDir, "logs");
  mkdirSync(logDir, { recursive: true });

  const logPath = join(logDir, "desktop-server.log");
  const stream = createWriteStream(logPath, { flags: "a" });
  stream.write(
    `\n[${new Date().toISOString()}] Orbit desktop local server startup\n`,
  );
  return { path: logPath, stream };
}

function writeLog(stream: WriteStream, message: string): void {
  stream.write(`[${new Date().toISOString()}] ${message}\n`);
}

function captureChildOutput(
  child: ChildProcess,
  logStream: WriteStream,
  recentOutput: RecentOutputBuffer,
): void {
  child.stdout?.on("data", (chunk: Buffer) => {
    recentOutput.push(chunk);
    logStream.write(chunk);
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    recentOutput.push(chunk);
    logStream.write(chunk);
    process.stderr.write(chunk);
  });
}

async function runDbBootstrap(
  cwd: string,
  env: NodeJS.ProcessEnv,
  logStream?: WriteStream,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawnChecked(
      resolveNodeBinary(cwd),
      ["scripts/desktop-db-bootstrap.mjs"],
      cwd,
      env,
    );
    const stderr: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => {
      logStream?.write(chunk);
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      logStream?.write(chunk);
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Desktop DB bootstrap failed (${signal ?? code}): ${Buffer.concat(stderr).toString("utf8").trim()}`,
          ),
        );
    });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function waitForServerReadyOrExit(
  child: ChildProcess,
  url: string,
  timeoutMs: number,
  runtimePlan: OrbitServerRuntimePlan,
  logPath: string,
  recentOutput: RecentOutputBuffer,
): Promise<void> {
  let exited = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let ready = false;

  const earlyExit = new Promise<never>((_, reject) => {
    child.once("exit", (code, signal) => {
      exited = true;
      exitCode = code;
      exitSignal = signal;
      if (ready) return;
      reject(
        new Error(
          [
            `Orbit desktop server exited before readiness (${signal ?? code ?? "unknown"}).`,
            `Runtime: ${runtimePlan.mode}`,
            `Command: ${runtimePlan.command} ${runtimePlan.args.join(" ")}`,
            `Log: ${logPath}`,
            recentOutput.text()
              ? `Recent server output:\n${recentOutput.text()}`
              : "Recent server output: <empty>",
          ].join("\n"),
        ),
      );
    });
  });

  try {
    await Promise.race([waitForHttpReady(url, timeoutMs), earlyExit]);
    ready = true;
  } catch (error) {
    if (!exited) {
      throw new Error(
        [
          error instanceof Error ? error.message : String(error),
          `Runtime: ${runtimePlan.mode}`,
          `Command: ${runtimePlan.command} ${runtimePlan.args.join(" ")}`,
          `Log: ${logPath}`,
          recentOutput.text()
            ? `Recent server output:\n${recentOutput.text()}`
            : "Recent server output: <empty>",
        ].join("\n"),
      );
    }
    throw error;
  }
  if (exitCode !== null || exitSignal !== null) {
    throw new Error(
      `Orbit desktop server exited during readiness (${exitSignal ?? exitCode}). Log: ${logPath}`,
    );
  }
}

export async function startOrbitLocalServer(
  options: OrbitLocalServerOptions = {},
): Promise<OrbitLocalServerHandle> {
  const cwd = options.cwd ?? repoRootFromElectronDir();
  const paths = ensureOrbitDesktopPaths(options.appName);
  const supervisorLog = createSupervisorLog(paths);
  const recentOutput = new RecentOutputBuffer();
  const port = await pickPort(options.port ?? "auto");
  const accessToken = createSessionAccessToken();
  const url = `http://127.0.0.1:${port}`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    ORBIT_DESKTOP_LOCAL: "1",
    ORBIT_DESKTOP_SESSION_ONLY_AUTH: "1",
    ORBIT_ACCESS_TOKEN: accessToken,
    DATABASE_URL: paths.databaseUrl,
    HOST: "127.0.0.1",
    PORT: String(port),
    ORBIT_DESKTOP_DISABLE_PASSWORD_SSH: "1",
  };
  const aliasNodePath = join(cwd, "dist", "node_modules");
  env.NODE_PATH = env.NODE_PATH
    ? `${aliasNodePath}${process.platform === "win32" ? ";" : ":"}${env.NODE_PATH}`
    : aliasNodePath;

  writeLog(supervisorLog.stream, `cwd=${cwd}`);
  writeLog(supervisorLog.stream, `database=${paths.databasePath}`);
  writeLog(supervisorLog.stream, `port=${port}`);

  await runDbBootstrap(cwd, env, supervisorLog.stream);

  const runtimePlan = resolveServerRuntimePlan(cwd);
  env.ORBIT_DESKTOP_SERVER_RUNTIME = runtimePlan.mode;
  env.ORBIT_DESKTOP_SERVER_RUNTIME_DESCRIPTION = runtimePlan.description;
  writeLog(
    supervisorLog.stream,
    `runtime=${runtimePlan.mode} command=${runtimePlan.command} ${runtimePlan.args.join(" ")}`,
  );

  const child = spawnChecked(
    runtimePlan.command,
    runtimePlan.args,
    runtimePlan.cwd,
    env,
  );
  captureChildOutput(child, supervisorLog.stream, recentOutput);

  try {
    await waitForServerReadyOrExit(
      child,
      `${url}/login`,
      options.readinessTimeoutMs ?? 90_000,
      runtimePlan,
      supervisorLog.path,
      recentOutput,
    );
  } catch (error) {
    await stopChild(child);
    supervisorLog.stream.end();
    throw error;
  }
  writeLog(supervisorLog.stream, `ready=${url}/login`);

  return {
    url,
    port,
    accessToken,
    paths,
    child,
    stop: async () => {
      await stopChild(child);
      supervisorLog.stream.end();
    },
  };
}
