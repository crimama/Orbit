import type { ClientChannel } from "ssh2";
import type { PtyBackend } from "@/server/pty/ptyBackend";
import { registerPtyBackend } from "@/server/pty/ptyBackend";
import { sshManager } from "@/server/ssh/sshManager";
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  SCROLLBACK_LIMIT,
} from "@/lib/constants";

type DataCallback = (data: string) => void;
type ExitCallback = (exitCode: number) => void;

interface RemoteSession {
  id: string;
  sshConfigId: string;
  channel: ClientChannel;
  cols: number;
  rows: number;
  lastActivity: number;
}

export interface RemoteCreateOptions {
  cols?: number;
  rows?: number;
  sshConfigId: string;
}

const READY_MARKER = "\x1b]777;orbit-ready\x07";
const READY_FALLBACK_MS = 10_000;

class RemotePtyManager implements PtyBackend {
  private sessions = new Map<string, RemoteSession>();
  private outputBuffers = new Map<string, string>();
  private dataListeners = new Map<string, Set<DataCallback>>();
  private exitListeners = new Map<string, Set<ExitCallback>>();
  private readySessions = new Set<string>();
  private readyCallbacks = new Map<string, Set<() => void>>();
  private readyTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async create(
    sessionId: string,
    opts: RemoteCreateOptions,
  ): Promise<RemoteSession> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Remote PTY session already exists: ${sessionId}`);
    }

    const cols = opts.cols ?? DEFAULT_COLS;
    const rows = opts.rows ?? DEFAULT_ROWS;

    const channel = await sshManager.createShell(opts.sshConfigId, {
      cols,
      rows,
    });

    const session: RemoteSession = {
      id: sessionId,
      sshConfigId: opts.sshConfigId,
      channel,
      cols,
      rows,
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.outputBuffers.set(sessionId, "");
    this.dataListeners.set(sessionId, new Set());
    this.exitListeners.set(sessionId, new Set());

    // Start fallback ready timer
    const fallbackTimer = setTimeout(() => {
      this.readyTimers.delete(sessionId);
      if (!this.readySessions.has(sessionId)) {
        this.markReady(sessionId);
      }
    }, READY_FALLBACK_MS);
    this.readyTimers.set(sessionId, fallbackTimer);

    channel.on("data", (data: Buffer) => {
      session.lastActivity = Date.now();
      let str = data.toString();

      // Check for ready marker before session is ready
      if (!this.readySessions.has(sessionId)) {
        const markerIdx = str.indexOf(READY_MARKER);
        if (markerIdx !== -1) {
          // Strip marker and everything before it
          str = str.slice(markerIdx + READY_MARKER.length);
          // Clear all pre-ready scrollback
          this.outputBuffers.set(sessionId, str);
          this.markReady(sessionId);
          // Only notify listeners with post-marker data
          if (str.length > 0) {
            const listeners = this.dataListeners.get(sessionId);
            if (listeners) listeners.forEach((cb) => cb(str));
          }
          return;
        }
        // Not ready yet — buffer silently, don't notify listeners
        let buf = this.outputBuffers.get(sessionId) ?? "";
        buf += str;
        if (buf.length > SCROLLBACK_LIMIT) {
          buf = buf.slice(buf.length - SCROLLBACK_LIMIT);
        }
        this.outputBuffers.set(sessionId, buf);
        return;
      }

      // Normal path (already ready)
      let buf = this.outputBuffers.get(sessionId) ?? "";
      buf += str;
      if (buf.length > SCROLLBACK_LIMIT) {
        buf = buf.slice(buf.length - SCROLLBACK_LIMIT);
      }
      this.outputBuffers.set(sessionId, buf);

      const listeners = this.dataListeners.get(sessionId);
      if (listeners) {
        listeners.forEach((cb) => cb(str));
      }
    });

    channel.on("close", () => {
      const exitCbs = this.exitListeners.get(sessionId);
      if (exitCbs) {
        exitCbs.forEach((cb) => cb(0));
      }
      this.cleanup(sessionId);
    });

    channel.stderr.on("data", (data: Buffer) => {
      session.lastActivity = Date.now();
      const str = data.toString();

      let buf = this.outputBuffers.get(sessionId) ?? "";
      buf += str;
      if (buf.length > SCROLLBACK_LIMIT) {
        buf = buf.slice(buf.length - SCROLLBACK_LIMIT);
      }
      this.outputBuffers.set(sessionId, buf);

      const listeners = this.dataListeners.get(sessionId);
      if (listeners) {
        listeners.forEach((cb) => cb(str));
      }
    });

    return session;
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  isReady(sessionId: string): boolean {
    return this.readySessions.has(sessionId);
  }

  onReady(sessionId: string, cb: () => void): () => void {
    if (this.readySessions.has(sessionId)) {
      cb();
      return () => {};
    }
    let cbs = this.readyCallbacks.get(sessionId);
    if (!cbs) {
      cbs = new Set();
      this.readyCallbacks.set(sessionId, cbs);
    }
    cbs.add(cb);
    return () => { cbs!.delete(cb); };
  }

  private markReady(sessionId: string): void {
    this.readySessions.add(sessionId);
    const timer = this.readyTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.readyTimers.delete(sessionId);
    }
    const cbs = this.readyCallbacks.get(sessionId);
    if (cbs) {
      cbs.forEach((cb) => cb());
      this.readyCallbacks.delete(sessionId);
    }
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastActivity = Date.now();
    session.channel.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const safeCols = Math.max(1, Math.floor(cols) || 80);
    const safeRows = Math.max(1, Math.floor(rows) || 24);
    session.cols = safeCols;
    session.rows = safeRows;
    try {
      session.channel.setWindow(safeRows, safeCols, safeRows * 16, safeCols * 8);
    } catch {
      // Resize can fail if channel is closed
    }
  }

  getScrollback(sessionId: string): string {
    return this.outputBuffers.get(sessionId) ?? "";
  }

  onData(sessionId: string, cb: DataCallback): () => void {
    const listeners = this.dataListeners.get(sessionId);
    if (!listeners) {
      throw new Error(`No remote PTY session: ${sessionId}`);
    }
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  onExit(sessionId: string, cb: ExitCallback): () => void {
    const listeners = this.exitListeners.get(sessionId);
    if (!listeners) {
      throw new Error(`No remote PTY session: ${sessionId}`);
    }
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    try {
      session.channel.close();
    } catch {
      // Channel may already be closed
    }
    this.cleanup(sessionId);
  }

  getIdleSessions(maxIdleMs: number): { id: string }[] {
    const now = Date.now();
    return Array.from(this.sessions.values())
      .filter((session) => now - session.lastActivity > maxIdleMs)
      .map((session) => ({ id: session.id }));
  }

  private cleanup(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.outputBuffers.delete(sessionId);
    this.dataListeners.delete(sessionId);
    this.exitListeners.delete(sessionId);
    this.readySessions.delete(sessionId);
    this.readyCallbacks.delete(sessionId);
    const timer = this.readyTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.readyTimers.delete(sessionId);
    }
  }
}

export const remotePtyManager = new RemotePtyManager();
registerPtyBackend(remotePtyManager);
