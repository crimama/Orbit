import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import { Socket } from "node:net";
import { assertValidPort } from "./urlValidation";

export type SshTunnelOptions = {
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  remoteOrbitPort: number;
  localPort: number;
  privateKeyPath?: string;
};

export type StartedSshTunnel = {
  process: ChildProcessWithoutNullStreams;
  argv: string[];
  ready: Promise<void>;
  stop: () => Promise<void>;
};

const SSH_SAFE_TEXT = /^[A-Za-z0-9._-]+$/;
const SSH_SAFE_HOST = /^[A-Za-z0-9.-]+$/;

export function buildSshTunnelArgv(options: SshTunnelOptions): string[] {
  const localPort = assertValidPort(options.localPort, "localPort");
  const remoteOrbitPort = assertValidPort(options.remoteOrbitPort, "remoteOrbitPort");
  const sshPort = assertValidPort(options.sshPort, "sshPort");
  const sshHost = validateSshHost(options.sshHost);
  const sshUsername = validateSshUsername(options.sshUsername);

  const argv = [
    "-N",
    "-L",
    `127.0.0.1:${localPort}:127.0.0.1:${remoteOrbitPort}`,
    "-p",
    String(sshPort),
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=30",
  ];

  if (options.privateKeyPath) {
    argv.push("-i", validatePrivateKeyPath(options.privateKeyPath));
  }

  argv.push(`${sshUsername}@${sshHost}`);
  return argv;
}

export async function startSshTunnel(options: SshTunnelOptions): Promise<StartedSshTunnel> {
  if (options.privateKeyPath) await access(options.privateKeyPath);
  const argv = buildSshTunnelArgv(options);
  const child = spawn("ssh", argv, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const ready = waitForTunnelReady({
    port: options.localPort,
    process: child,
    getStderr: () => stderr,
  });

  return {
    process: child,
    argv,
    ready,
    stop: () => stopTunnel(child),
  };
}

export async function waitForTunnelReady({
  port,
  process,
  timeoutMs = 10_000,
  intervalMs = 100,
  getStderr = () => "",
}: {
  port: number;
  process?: ChildProcessWithoutNullStreams;
  timeoutMs?: number;
  intervalMs?: number;
  getStderr?: () => string;
}): Promise<void> {
  assertValidPort(port, "localPort");
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (process?.exitCode !== null) {
      throw new Error(classifySshTunnelError(getStderr(), process.exitCode ?? undefined));
    }
    if (await canConnect(port)) return;
    await delay(intervalMs);
  }

  throw new Error(classifySshTunnelError(getStderr()) || `Timed out waiting for SSH tunnel on 127.0.0.1:${port}`);
}

export function classifySshTunnelError(stderr: string, exitCode?: number): string {
  const text = stderr.toLowerCase();
  if (/permission denied|authentication failed|publickey/.test(text)) {
    return "SSH authentication failed; check key, agent, username, and host permissions";
  }
  if (/host key verification failed|remote host identification has changed/.test(text)) {
    return "SSH host key verification failed; verify the remote host before connecting";
  }
  if (/address already in use|bind:.*address/.test(text)) {
    return "Local tunnel port is already in use; choose another local port";
  }
  if (/connection refused|connect failed|open failed/.test(text)) {
    return "Remote Orbit port refused the tunnel connection; verify Orbit is running on remote loopback";
  }
  if (/could not resolve hostname|name or service not known/.test(text)) {
    return "SSH host could not be resolved";
  }
  if (exitCode !== undefined) return `SSH tunnel exited before readiness with code ${exitCode}`;
  return "";
}

async function stopTunnel(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    delay(1_500).then(() => {
      if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
    }),
  ]);
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(300);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, "127.0.0.1");
  });
}

function validateSshHost(host: string): string {
  const trimmed = host.trim();
  if (!SSH_SAFE_HOST.test(trimmed) || trimmed.startsWith("-") || trimmed.includes("..")) {
    throw new Error("SSH host must be a hostname or address without shell metacharacters");
  }
  return trimmed;
}

function validateSshUsername(username: string): string {
  const trimmed = username.trim();
  if (!SSH_SAFE_TEXT.test(trimmed) || trimmed.startsWith("-")) {
    throw new Error("SSH username contains unsupported characters");
  }
  return trimmed;
}

function validatePrivateKeyPath(path: string): string {
  if (path.includes("\0") || path.trim() === "") throw new Error("privateKeyPath is invalid");
  return path;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
