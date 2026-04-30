import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import { join } from "node:path";

import { ensureOrbitDesktopPaths, type OrbitDesktopPaths } from "./desktopPaths.js";

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

async function waitForHttpReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = httpRequest(url, { method: "GET", timeout: 1_000 }, (res) => {
          res.resume();
          resolve();
        });
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

function spawnChecked(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(command, args, {
    cwd,
    env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function runDbBootstrap(cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawnChecked(process.execPath, ["scripts/desktop-db-bootstrap.mjs"], cwd, env);
    const stderr: Buffer[] = [];
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Desktop DB bootstrap failed (${signal ?? code}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
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

export async function startOrbitLocalServer(
  options: OrbitLocalServerOptions = {},
): Promise<OrbitLocalServerHandle> {
  const cwd = options.cwd ?? repoRootFromElectronDir();
  const paths = ensureOrbitDesktopPaths(options.appName);
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

  await runDbBootstrap(cwd, env);

  const child = spawnChecked(
    process.execPath,
    ["--import", "tsx", join(cwd, "server.ts")],
    cwd,
    env,
  );
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);

  try {
    await waitForHttpReady(`${url}/login`, options.readinessTimeoutMs ?? 30_000);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  return {
    url,
    port,
    accessToken,
    paths,
    child,
    stop: () => stopChild(child),
  };
}
