import { Client } from "ssh2";
import type { ClientChannel } from "ssh2";
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
  private statusListeners = new Set<StatusCallback>();

  private applyAuthConfig(
    connectConfig: Record<string, unknown>,
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
    if (existing && (existing.state === "connected" || existing.state === "connecting")) {
      return;
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

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end();
        this.setState(configId, "error", "Connection timed out");
        reject(new Error("SSH connection timed out"));
      }, SSH_CONNECT_TIMEOUT_MS);

      client.on("ready", () => {
        clearTimeout(timeout);
        entry.state = "connected";
        entry.retryCount = 0;
        this.emitStatus(configId);
        console.log(`[SSH] Connected to ${config.host}:${config.port} (${configId})`);
        resolve();
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        console.error(`[SSH] Error for ${configId}:`, err.message);
        this.setState(configId, "error", err.message);
        // Only reject if this is the initial connect (not a reconnect attempt)
        if (entry.retryCount === 0) {
          reject(err);
        }
      });

      client.on("close", () => {
        const current = this.connections.get(configId);
        if (!current || current.client !== client) return;

        // If we were connected, attempt reconnect
        if (current.state === "connected") {
          console.log(`[SSH] Connection closed for ${configId}, attempting reconnect...`);
          this.scheduleReconnect(configId, config);
        }
      });

      client.on("end", () => {
        const current = this.connections.get(configId);
        if (current && current.client === client && current.state === "connected") {
          this.setState(configId, "disconnected");
        }
      });

      // Build auth config
      const connectConfig: Record<string, unknown> = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: SSH_CONNECT_TIMEOUT_MS,
        keepaliveInterval: SSH_KEEPALIVE_INTERVAL_MS,
        keepaliveCountMax: 3,
      };

      const authError = this.applyAuthConfig(connectConfig, config);
      if (authError) {
        clearTimeout(timeout);
        this.setState(configId, "error", authError);
        reject(new Error(authError));
        return;
      }

      if (config.proxyConfigId) {
        this.connect(config.proxyConfigId)
          .then(() => {
            const proxyClient = this.getConnection(config.proxyConfigId!);
            if (!proxyClient) {
              throw new Error(`Proxy SSH not connected: ${config.proxyConfigId}`);
            }
            proxyClient.forwardOut(
              "127.0.0.1",
              0,
              config.host,
              config.port,
              (err, stream) => {
                if (err) {
                  clearTimeout(timeout);
                  this.setState(configId, "error", `Proxy forward failed: ${err.message}`);
                  reject(err);
                  return;
                }
                connectConfig.sock = stream;
                client.connect(connectConfig);
              },
            );
          })
          .catch((err) => {
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
  }

  private scheduleReconnect(
    configId: string,
    config: {
      host: string;
      port: number;
      username: string;
      authMethod: string;
      keyPath: string | null;
      password: string | null;
      proxyConfigId: string | null;
    },
  ): void {
    const entry = this.connections.get(configId);
    if (!entry) return;

    if (entry.retryCount >= SSH_RECONNECT_MAX_RETRIES) {
      console.log(`[SSH] Max retries reached for ${configId}`);
      this.setState(configId, "error", "Max reconnect retries reached");
      return;
    }

    entry.retryCount++;
    const delay = SSH_RECONNECT_BASE_DELAY_MS * Math.pow(2, entry.retryCount - 1);
    console.log(`[SSH] Reconnecting ${configId} in ${delay}ms (attempt ${entry.retryCount})`);

    entry.retryTimer = setTimeout(async () => {
      const current = this.connections.get(configId);
      if (!current || current.configId !== configId) return;

      const newClient = new Client();
      current.client = newClient;
      current.state = "connecting";
      this.emitStatus(configId);

      newClient.on("ready", () => {
        current.state = "connected";
        current.retryCount = 0;
        this.emitStatus(configId);
        console.log(`[SSH] Reconnected to ${config.host}:${config.port} (${configId})`);
      });

      newClient.on("error", (err) => {
        console.error(`[SSH] Reconnect error for ${configId}:`, err.message);
        this.setState(configId, "error", err.message);
      });

      newClient.on("close", () => {
        const c = this.connections.get(configId);
        if (c && c.client === newClient && c.state === "connected") {
          this.scheduleReconnect(configId, config);
        }
      });

      const connectConfig: Record<string, unknown> = {
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
            this.setState(configId, "error", `Proxy SSH not connected: ${config.proxyConfigId}`);
            return;
          }
          proxyClient.forwardOut(
            "127.0.0.1",
            0,
            config.host,
            config.port,
            (err, stream) => {
              if (err) {
                this.setState(configId, "error", `Proxy forward failed: ${err.message}`);
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
            reject(new Error(`Command failed (exit ${code}): ${stderr.trim()}`));
          } else {
            resolve(stdout);
          }
        });
      });
    });
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
