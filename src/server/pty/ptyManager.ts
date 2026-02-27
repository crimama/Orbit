import * as pty from "node-pty";
import type { PtySession } from "@/lib/types";
import type { PtyBackend } from "@/server/pty/ptyBackend";
import { registerPtyBackend } from "@/server/pty/ptyBackend";
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  DEFAULT_SHELL,
  SCROLLBACK_LIMIT,
} from "@/lib/constants";

type DataCallback = (data: string) => void;
type ExitCallback = (exitCode: number) => void;

export interface CreateOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

class PtyManager implements PtyBackend {
  private sessions = new Map<string, PtySession>();
  private outputBuffers = new Map<string, string>();
  private dataListeners = new Map<string, Set<DataCallback>>();
  private exitListeners = new Map<string, Set<ExitCallback>>();

  create(sessionId: string, opts: CreateOptions = {}): PtySession {
    if (this.sessions.has(sessionId)) {
      throw new Error(`PTY session already exists: ${sessionId}`);
    }

    const cols = opts.cols ?? DEFAULT_COLS;
    const rows = opts.rows ?? DEFAULT_ROWS;
    const cwd = opts.cwd ?? process.env.HOME ?? "/";

    const command = opts.command ?? DEFAULT_SHELL;
    const args = opts.args ?? [];
    const env = {
      ...(process.env as Record<string, string>),
      ...(opts.env ?? {}),
    };

    const proc = pty.spawn(command, args, {
      name: "xterm-color",
      cols,
      rows,
      cwd,
      env,
    });

    const session: PtySession = {
      id: sessionId,
      process: proc,
      cols,
      rows,
      lastActivity: Date.now(),
      cwd,
    };

    this.sessions.set(sessionId, session);
    this.outputBuffers.set(sessionId, "");
    this.dataListeners.set(sessionId, new Set());
    this.exitListeners.set(sessionId, new Set());

    proc.onData((data: string) => {
      session.lastActivity = Date.now();

      // Append to scrollback buffer
      let buf = this.outputBuffers.get(sessionId) ?? "";
      buf += data;
      if (buf.length > SCROLLBACK_LIMIT) {
        buf = buf.slice(buf.length - SCROLLBACK_LIMIT);
      }
      this.outputBuffers.set(sessionId, buf);

      // Notify listeners
      const listeners = this.dataListeners.get(sessionId);
      if (listeners) {
        listeners.forEach((cb) => cb(data));
      }
    });

    proc.onExit(({ exitCode }) => {
      const exitCbs = this.exitListeners.get(sessionId);
      if (exitCbs) {
        exitCbs.forEach((cb) => cb(exitCode));
      }
      this.cleanup(sessionId);
    });

    return session;
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.process.kill();
    } catch {
      // Process may already be dead
    }
    this.cleanup(sessionId);
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastActivity = Date.now();
    session.process.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.cols = cols;
    session.rows = rows;
    try {
      session.process.resize(cols, rows);
    } catch {
      // Resize can fail if process is dead
    }
  }

  get(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId);
  }

  getAll(): PtySession[] {
    return Array.from(this.sessions.values());
  }

  getScrollback(sessionId: string): string {
    return this.outputBuffers.get(sessionId) ?? "";
  }

  onData(sessionId: string, callback: DataCallback): () => void {
    const listeners = this.dataListeners.get(sessionId);
    if (!listeners) {
      throw new Error(`No PTY session: ${sessionId}`);
    }
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }

  onExit(sessionId: string, callback: ExitCallback): () => void {
    const listeners = this.exitListeners.get(sessionId);
    if (!listeners) {
      throw new Error(`No PTY session: ${sessionId}`);
    }
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }

  getIdleSessions(maxIdleMs: number): PtySession[] {
    const now = Date.now();
    return this.getAll().filter((s) => now - s.lastActivity > maxIdleMs);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  private cleanup(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.outputBuffers.delete(sessionId);
    this.dataListeners.delete(sessionId);
    this.exitListeners.delete(sessionId);
  }
}

export const ptyManager = new PtyManager();
registerPtyBackend(ptyManager);
