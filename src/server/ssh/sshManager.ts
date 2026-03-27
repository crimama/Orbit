import { Client } from "ssh2";
import type { ClientChannel, ConnectConfig } from "ssh2";
import type { SFTPWrapper } from "ssh2";
import { readFileSync } from "fs";
import { prisma } from "@/lib/prisma";
import { decryptSshPassword } from "@/server/ssh/credentials";
import {
  SSH_CONNECT_TIMEOUT_MS,
  SSH_KEEPALIVE_INTERVAL_MS,
  SSH_RECONNECT_MAX_RETRIES,
  SSH_RECONNECT_BASE_DELAY_MS,
} from "@/lib/constants";
import type { SshConnectionState, SshConnectionStatus } from "@/lib/types";

type StatusCallback = (status: SshConnectionStatus) => void;

interface ConnectionEntry {
  client: Client;
  configId: string;
  state: SshConnectionState;
  error?: string;
  retryCount: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

class SshManager {
  private connections = new Map<string, ConnectionEntry>();
  private connectPromises = new Map<string, Promise<void>>();
  private statusListeners = new Set<StatusCallback>();
  private reconnectListeners = new Map<string, Set<() => void>>();
  private lastStableAt = new Map<string, number>();

  /** Register a callback to be fired after a successful reconnect for a given configId.
   *  Returns an unsubscribe function. */
  onReconnect(configId: string, cb: () => void): () => void {
    let cbs = this.reconnectListeners.get(configId);
    if (!cbs) {
      cbs = new Set();
      this.reconnectListeners.set(configId, cbs);
    }
    cbs.add(cb);
    return () => {
      cbs!.delete(cb);
      if (cbs!.size === 0) this.reconnectListeners.delete(configId);
    };
  }

  private fireReconnectListeners(configId: string): void {
    const cbs = this.reconnectListeners.get(configId);
    if (cbs) {
      cbs.forEach((cb) => {
        try { cb(); } catch (err) {
          console.error(`[SSH] Reconnect listener error for ${configId}:`, err);
        }
      });
    }
  }

  private applyAuthConfig(
    connectConfig: Partial<ConnectConfig>,
    config: {
      authMethod: string;
      keyPath: string | null;
      password: string | null;
    },
  ): string | null {
    if (config.authMethod === "key") {
      if (!config.keyPath) return "SSH key path is not configured";
      try {
        connectConfig.privateKey = readFileSync(config.keyPath);
      } catch (err) {
        return `Cannot read SSH key: ${config.keyPath} - ${err instanceof Error ? err.message : String(err)}`;
      }
      return null;
    }

    if (config.authMethod === "password") {
      if (!config.password) return "SSH password is not configured";
      try {
        connectConfig.password = decryptSshPassword(config.password);
      } catch (err) {
        return `Cannot decrypt SSH password: ${err instanceof Error ? err.message : String(err)}`;
      }
      return null;
    }

    return `Unsupported auth method: ${config.authMethod}`;
  }

  /** Subscribe to status changes for all connections */
  onStatus(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private emitStatus(configId: string): void {
    const status = this.getStatus(configId);
    this.statusListeners.forEach((cb) => cb(status));
  }

  private setState(
    configId: string,
    state: SshConnectionState,
    error?: string,
  ): void {
    const entry = this.connections.get(configId);
    if (entry) {
      entry.state = state;
      entry.error = error;
    }
    this.emitStatus(configId);
  }

  /** Connect to an SSH server using config from DB */
  async connect(configId: string): Promise<void> {
    // If already connected or connecting, skip
    const existing = this.connections.get(configId);
    if (existing?.state === "connected") {
      return;
    }
    if (existing?.state === "connecting") {
      const pending = this.connectPromises.get(configId);
      if (pending) {
        await pending;
        return;
      }
    }

    const config = await prisma.sshConfig.findUnique({
      where: { id: configId },
    });
    if (!config) {
      throw new Error(`SSH config not found: ${configId}`);
    }
    if (config.proxyConfigId === configId) {
      throw new Error("proxyConfigId cannot point to itself");
    }

    const client = new Client();
    const entry: ConnectionEntry = {
      client,
      configId,
      state: "connecting",
      retryCount: 0,
      retryTimer: null,
    };
    this.connections.set(configId, entry);
    this.emitStatus(configId);

    const connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        client.removeAllListeners("error");
        client.end();
        this.setState(configId, "error", "Connection timed out");
        reject(new Error("SSH connection timed out"));
      }, SSH_CONNECT_TIMEOUT_MS);

      client.on("ready", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        entry.state = "connected";
        entry.retryCount = 0;
        this.emitStatus(configId);
        console.log(
          `[SSH] Connected to ${config.host}:${config.port} (${configId})`,
        );
        resolve();
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        console.error(`[SSH] Error for ${configId}:`, err.message);
        this.setState(configId, "error", err.message);
        // Only reject if this is the initial connect (not a reconnect attempt)
        if (!settled && entry.retryCount === 0) {
          settled = true;
          reject(err);
        }
      });

      client.on("close", () => {
        const current = this.connections.get(configId);
        if (!current || current.client !== client) return;

        // If we were connected, attempt reconnect
        if (current.state === "connected") {
          console.log(
            `[SSH] Connection closed for ${configId}, attempting reconnect...`,
          );
          this.scheduleReconnect(configId);
        }
      });

      client.on("end", () => {
        const current = this.connections.get(configId);
        if (
          current &&
          current.client === client &&
          current.state === "connected"
        ) {
          this.setState(configId, "disconnected");
        }
      });

      // Build auth config
      const connectConfig: Partial<ConnectConfig> = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: SSH_CONNECT_TIMEOUT_MS,
        keepaliveInterval: SSH_KEEPALIVE_INTERVAL_MS,
        keepaliveCountMax: 3,
      };

      const authError = this.applyAuthConfig(connectConfig, config);
      if (authError) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.setState(configId, "error", authError);
        reject(new Error(authError));
        return;
      }

      if (config.proxyConfigId) {
        this.connect(config.proxyConfigId)
          .then(() => {
            if (settled) return;
            const proxyClient = this.getConnection(config.proxyConfigId!);
            if (!proxyClient) {
              throw new Error(
                `Proxy SSH not connected: ${config.proxyConfigId}`,
              );
            }
            proxyClient.forwardOut(
              "127.0.0.1",
              0,
              config.host,
              config.port,
              (err, stream) => {
                if (err) {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timeout);
                  this.setState(
                    configId,
                    "error",
                    `Proxy forward failed: ${err.message}`,
                  );
                  reject(err);
                  return;
                }
                connectConfig.sock = stream;
                client.connect(connectConfig);
              },
            );
          })
          .catch((err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            this.setState(
              configId,
              "error",
              `Proxy connect failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            reject(err);
          });
      } else {
        client.connect(connectConfig);
      }
    });

    this.connectPromises.set(configId, connectPromise);
    try {
      await connectPromise;
    } finally {
      this.connectPromises.delete(configId);
    }
  }

  private scheduleReconnect(configId: string): void {
    const entry = this.connections.get(configId);
    if (!entry) return;

    // R-4: Only reset retry count if connection was stable for 60+ seconds
    const stableTs = this.lastStableAt.get(configId);
    if (stableTs && Date.now() - stableTs > 60_000) {
      entry.retryCount = 0;
    }

    if (entry.retryCount >= SSH_RECONNECT_MAX_RETRIES) {
      console.log(`[SSH] Max retries reached for ${configId}`);
      this.setState(configId, "error", "Max reconnect retries reached");
      return;
    }

    entry.retryCount++;
    const delay =
      SSH_RECONNECT_BASE_DELAY_MS * Math.pow(2, entry.retryCount - 1);
    console.log(
      `[SSH] Reconnecting ${configId} in ${delay}ms (attempt ${entry.retryCount})`,
    );

    entry.retryTimer = setTimeout(async () => {
      const current = this.connections.get(configId);
      if (!current || current.configId !== configId) return;

      // R-3: Re-fetch config from DB to get fresh credentials
      const config = await prisma.sshConfig.findUnique({
        where: { id: configId },
      });
      if (!config) {
        this.setState(configId, "error", `SSH config not found: ${configId}`);
        return;
      }

      const newClient = new Client();
      current.client = newClient;
      current.state = "connecting";
      this.emitStatus(configId);

      newClient.on("ready", () => {
        current.state = "connected";
        // R-4: Record stable timestamp instead of resetting retryCount
        this.lastStableAt.set(configId, Date.now());
        this.emitStatus(configId);
        console.log(
          `[SSH] Reconnected to ${config.host}:${config.port} (${configId})`,
        );
        // R-1: Fire reconnect listeners so remotePtyManager can re-open channels
        this.fireReconnectListeners(configId);
      });

      newClient.on("error", (err) => {
        console.error(`[SSH] Reconnect error for ${configId}:`, err.message);
        this.setState(configId, "error", err.message);
      });

      newClient.on("close", () => {
        const c = this.connections.get(configId);
        if (c && c.client === newClient && c.state === "connected") {
          this.scheduleReconnect(configId);
        }
      });

      const connectConfig: Partial<ConnectConfig> = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: SSH_CONNECT_TIMEOUT_MS,
        keepaliveInterval: SSH_KEEPALIVE_INTERVAL_MS,
        keepaliveCountMax: 3,
      };

      const authError = this.applyAuthConfig(connectConfig, config);
      if (authError) {
        this.setState(configId, "error", authError);
        return;
      }

      if (config.proxyConfigId) {
        try {
          await this.connect(config.proxyConfigId);
          const proxyClient = this.getConnection(config.proxyConfigId);
          if (!proxyClient) {
            this.setState(
              configId,
              "error",
              `Proxy SSH not connected: ${config.proxyConfigId}`,
            );
            return;
          }
          proxyClient.forwardOut(
            "127.0.0.1",
            0,
            config.host,
            config.port,
            (err, stream) => {
              if (err) {
                this.setState(
                  configId,
                  "error",
                  `Proxy forward failed: ${err.message}`,
                );
                return;
              }
              connectConfig.sock = stream;
              newClient.connect(connectConfig);
            },
          );
        } catch (err) {
          this.setState(
            configId,
            "error",
            `Proxy connect failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        newClient.connect(connectConfig);
      }
    }, delay);
  }

  /** Disconnect a specific SSH connection */
  disconnect(configId: string): void {
    const entry = this.connections.get(configId);
    if (!entry) return;

    if (entry.retryTimer) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = null;
    }

    try {
      entry.client.end();
    } catch {
      // Client may already be closed
    }

    this.connections.delete(configId);
    this.reconnectListeners.delete(configId);
    this.lastStableAt.delete(configId);
    this.emitStatus(configId);
    console.log(`[SSH] Disconnected: ${configId}`);
  }

  /** Disconnect all SSH connections (for graceful shutdown) */
  disconnectAll(): void {
    Array.from(this.connections.keys()).forEach((configId) => {
      this.disconnect(configId);
    });
  }

  /** Get the ssh2 Client for a given configId, or null if not connected */
  getConnection(configId: string): Client | null {
    const entry = this.connections.get(configId);
    if (!entry || entry.state !== "connected") return null;
    return entry.client;
  }

  /** Create an interactive shell on the remote server */
  async createShell(
    configId: string,
    opts: { cols: number; rows: number },
  ): Promise<ClientChannel> {
    const client = this.getConnection(configId);
    if (!client) {
      throw new Error(`SSH not connected: ${configId}`);
    }

    return new Promise<ClientChannel>((resolve, reject) => {
      client.shell(
        {
          term: "xterm-color",
          cols: opts.cols,
          rows: opts.rows,
        },
        (err, channel) => {
          if (err) {
            reject(err);
          } else {
            resolve(channel);
          }
        },
      );
    });
  }

  /** Execute a single command on the remote server */
  async exec(configId: string, command: string): Promise<string> {
    const client = this.getConnection(configId);
    if (!client) {
      throw new Error(`SSH not connected: ${configId}`);
    }

    return new Promise<string>((resolve, reject) => {
      client.exec(command, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = "";
        let stderr = "";

        channel.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        channel.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        channel.on("close", (code: number) => {
          if (code !== 0 && stderr) {
            reject(
              new Error(`Command failed (exit ${code}): ${stderr.trim()}`),
            );
          } else {
            resolve(stdout);
          }
        });
      });
    });
  }

  async withSftp<T>(
    configId: string,
    fn: (sftp: SFTPWrapper) => Promise<T>,
  ): Promise<T> {
    const openAndRun = async (): Promise<T> => {
      if (this.getStatus(configId).state !== "connected") {
        await this.connect(configId);
      }

      const client = this.getConnection(configId);
      if (!client) {
        throw new Error(`SSH not connected: ${configId}`);
      }

      const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
        client.sftp((err, wrapper) => {
          if (err || !wrapper) {
            reject(err ?? new Error("Failed to open SFTP channel"));
            return;
          }
          resolve(wrapper);
        });
      });

      try {
        return await fn(sftp);
      } finally {
        try {
          sftp.end();
        } catch {}
      }
    };

    try {
      return await openAndRun();
    } catch {
      return openAndRun();
    }
  }

  /** Get the current connection status for a configId */
  getStatus(configId: string): SshConnectionStatus {
    const entry = this.connections.get(configId);
    if (!entry) {
      return { configId, state: "disconnected" };
    }
    return {
      configId,
      state: entry.state,
      error: entry.error,
    };
  }
}

export const sshManager = new SshManager();
