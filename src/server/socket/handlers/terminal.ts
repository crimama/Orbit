import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { getPtyBackend } from "@/server/pty/ptyBackend";
import { commandInterceptor } from "@/server/pty/interceptor";
import { sessionManager } from "@/server/session/sessionManager";
import { compressIfNeeded, DeltaBatcher } from "@/server/ssh/deltaStream";
import { tokenTracker } from "@/server/observability/tokenTracker";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type {
  SessionInfo,
  SessionNotification,
  SessionContext,
} from "@/lib/types";

const RAW_IO_CAPTURE_ENV_KEYS = [
  "ORBIT_AGENT_RUN_LEDGER_RAW_IO",
  "ORBIT_CAPTURE_RAW_TERMINAL_IO",
] as const;
const LEDGER_PREVIEW_LIMIT = 512;
const LEDGER_RAW_LIMIT = 8192;
const OUTPUT_LEDGER_FLUSH_MS = 750;
const OUTPUT_LEDGER_FLUSH_CHARS = 4096;

type TerminalIoDirection = "input" | "output";

interface TerminalIoPayload {
  direction: TerminalIoDirection;
  rawCaptured: boolean;
  byteLength: number;
  charLength: number;
  lineCount: number;
  preview: string;
  previewTruncated: boolean;
  redacted: boolean;
  data?: string;
  dataTruncated?: boolean;
}

function isRawIoCaptureEnabled(): boolean {
  return RAW_IO_CAPTURE_ENV_KEYS.some((key) => {
    const value = process.env[key];
    return value === "1" || value?.toLowerCase() === "true";
  });
}

function stripAnsi(value: string): string {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

function redactTerminalPreview(value: string): {
  value: string;
  redacted: boolean;
} {
  const withoutAnsi = stripAnsi(value);
  const redacted = withoutAnsi
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[REDACTED]")
    .replace(
      /((?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*)([^\s'";]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "[REDACTED]");
  return { value: redacted, redacted: redacted !== value };
}

function cap(
  value: string,
  limit: number,
): { value: string; truncated: boolean } {
  if (value.length <= limit) return { value, truncated: false };
  return { value: value.slice(0, limit), truncated: true };
}

function createTerminalIoPayload(
  direction: TerminalIoDirection,
  data: string,
): TerminalIoPayload {
  const rawCaptured = isRawIoCaptureEnabled();
  const redactedPreview = redactTerminalPreview(data);
  const preview = cap(redactedPreview.value, LEDGER_PREVIEW_LIMIT);
  const payload: TerminalIoPayload = {
    direction,
    rawCaptured,
    byteLength: Buffer.byteLength(data),
    charLength: data.length,
    lineCount: data.length === 0 ? 0 : data.split(/\r\n|\r|\n/).length,
    preview: preview.value,
    previewTruncated: preview.truncated,
    redacted: redactedPreview.redacted,
  };

  if (rawCaptured) {
    const raw = cap(data, LEDGER_RAW_LIMIT);
    payload.data = raw.value;
    payload.dataTruncated = raw.truncated;
  }

  return payload;
}

function extractOscEvents(
  sessionId: string,
  data: string,
  socket: OrbitSocket,
): string {
  let cleaned = data;

  // All regex created per-call to avoid shared lastIndex state across sessions
  const oscNotifyRe = /\x1b\]777;notify;([^;]*);([^\x07]*)\x07/g;
  const oscCwdRe = /\x1b\]7;file:\/\/[^/]*([^\x07]*)\x07/g;

  // Extract notifications
  let match: RegExpExecArray | null;
  while ((match = oscNotifyRe.exec(data)) !== null) {
    const notification: SessionNotification = {
      sessionId,
      title: match[1] || "Notification",
      body: match[2] || "",
      timestamp: new Date().toISOString(),
    };
    socket.emit("session-notify", notification);
  }
  cleaned = cleaned.replace(oscNotifyRe, "");

  // Extract cwd
  while ((match = oscCwdRe.exec(data)) !== null) {
    const ctx: SessionContext = {
      sessionId,
      cwd: decodeURIComponent(match[1]),
    };
    socket.emit("session-context", ctx);
  }
  cleaned = cleaned.replace(oscCwdRe, "");

  // Agent Teams pattern detection (non-destructive, no g flag needed)
  if (/\[Agent Teams?\]\s*(?:teammate|agent)\s+\S+\s+is idle/i.test(data)) {
    socket.emit("session-notify", {
      sessionId,
      title: "Agent Idle",
      body: "A teammate has finished and is waiting for work",
      timestamp: new Date().toISOString(),
    });
  }
  if (/\[Agent Teams?\]\s*(?:task|work)\s+completed/i.test(data)) {
    socket.emit("session-notify", {
      sessionId,
      title: "Task Completed",
      body: "An agent task has been completed",
      timestamp: new Date().toISOString(),
    });
  }
  if (
    /\[Agent Teams?\]\s*(?:question|elicitation|waiting for input)/i.test(data)
  ) {
    socket.emit("session-notify", {
      sessionId,
      title: "Agent Question",
      body: "An agent is waiting for your input",
      timestamp: new Date().toISOString(),
    });
  }

  return cleaned;
}

export function registerTerminalHandlers(
  io: OrbitServer,
  socket: OrbitSocket,
): void {
  let unsubData: (() => void) | null = null;
  let unsubExit: (() => void) | null = null;
  let unsubReady: (() => void) | null = null;
  let batcher: DeltaBatcher | null = null;
  let sessionRoom: string | null = null;
  let outputLedgerBuffer = "";
  let outputLedgerFlushTimer: ReturnType<typeof setTimeout> | null = null;

  function clearOutputLedgerFlushTimer() {
    if (outputLedgerFlushTimer) {
      clearTimeout(outputLedgerFlushTimer);
      outputLedgerFlushTimer = null;
    }
  }

  function flushOutputLedger(sessionId: string) {
    clearOutputLedgerFlushTimer();
    if (!outputLedgerBuffer) return;

    const data = outputLedgerBuffer;
    outputLedgerBuffer = "";
    void agentRunLedger
      .appendEventBySession(
        sessionId,
        "terminal-output",
        createTerminalIoPayload("output", data),
        "pty",
      )
      .catch((err) => {
        console.error("[AgentRunLedger] failed to record output:", err);
      });
  }

  function queueOutputLedgerEvent(sessionId: string, data: string) {
    outputLedgerBuffer += data;

    if (outputLedgerBuffer.length >= OUTPUT_LEDGER_FLUSH_CHARS) {
      flushOutputLedger(sessionId);
      return;
    }

    if (!outputLedgerFlushTimer) {
      outputLedgerFlushTimer = setTimeout(() => {
        flushOutputLedger(sessionId);
      }, OUTPUT_LEDGER_FLUSH_MS);
    }
  }

  function detach() {
    if (sessionRoom) {
      socket.leave(sessionRoom);
      sessionRoom = null;
    }
    const attachedSessionId = socket.data.attachedSessionId;
    if (attachedSessionId) {
      flushOutputLedger(attachedSessionId);
    } else {
      clearOutputLedgerFlushTimer();
      outputLedgerBuffer = "";
    }
    batcher?.destroy();
    batcher = null;
    if (unsubReady) {
      unsubReady();
      unsubReady = null;
    }
    if (unsubData) {
      unsubData();
      unsubData = null;
    }
    if (unsubExit) {
      unsubExit();
      unsubExit = null;
    }
    socket.data.attachedSessionId = null;
  }

  socket.on("session-attach", async (sessionId, callback) => {
    detach();

    // Check all backends (local + remote)
    let backend = getPtyBackend(sessionId);

    if (!backend) {
      const running = await sessionManager.ensureSessionRunning(sessionId);
      if (!running) {
        callback({ ok: false, error: "Session not found or not running" });
        return;
      }
      backend = getPtyBackend(sessionId);
    }

    if (!backend) {
      callback({ ok: false, error: "Backend unavailable after session start" });
      return;
    }

    // Capture as const for inner functions
    const resolvedBackend = backend;

    socket.data.attachedSessionId = sessionId;
    sessionRoom = `session:${sessionId}`;
    await socket.join(sessionRoom);

    // Helper: start streaming scrollback + live data once ready
    function startStreaming() {
      const scrollback = resolvedBackend.getScrollback(sessionId);
      if (scrollback) {
        void compressIfNeeded(scrollback)
          .then((result) => {
            if (result.compressed) {
              socket.emit("terminal-data-compressed", result.payload as Buffer);
            } else {
              socket.emit("terminal-data", result.payload as string);
            }
          })
          .catch((err) => {
            console.error("[terminal] scrollback compression failed:", err);
            socket.emit("terminal-data", scrollback);
          });
      }

      batcher = new DeltaBatcher((payload, compressed) => {
        if (compressed) {
          socket.emit("terminal-data-compressed", payload as Buffer);
        } else {
          socket.emit("terminal-data", payload as string);
        }
      });

      unsubData = resolvedBackend.onData(sessionId, (data) => {
        const cleaned = extractOscEvents(sessionId, data, socket);
        void tokenTracker.processOutput(sessionId, cleaned);
        if (cleaned) {
          queueOutputLedgerEvent(sessionId, cleaned);
          batcher?.push(cleaned);
        }
      });

      socket.emit("session-ready", sessionId);
      void agentRunLedger
        .appendEventBySession(sessionId, "session-ready", {}, "socket")
        .catch((err) => {
          console.error(
            "[AgentRunLedger] failed to record session-ready:",
            err,
          );
        });
    }

    unsubExit = resolvedBackend.onExit(sessionId, async (exitCode) => {
      const preview = resolvedBackend.getScreenPreview(sessionId);
      socket.emit("session-exit", sessionId, exitCode);
      void agentRunLedger
        .appendEventBySession(sessionId, "session-exit", { exitCode }, "socket")
        .then(async (event) => {
          if (event) {
            const run = await agentRunLedger.ensureRunForSession(sessionId);
            if (run)
              await agentRunLedger.updateRun(run.id, { status: "completed" });
          }
        })
        .catch((err) => {
          console.error("[AgentRunLedger] failed to record session-exit:", err);
        });
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        const sessionUpdate: SessionInfo = {
          ...session,
          status: "terminated",
          lastContext: preview || session.lastContext,
        };
        sessionManager.queueSessionUpdate(sessionUpdate);
      }
      detach();
    });

    // Gate streaming on backend ready state
    if (resolvedBackend.isReady(sessionId)) {
      startStreaming();
    } else {
      unsubReady = resolvedBackend.onReady(sessionId, () => {
        unsubReady = null;
        startStreaming();
      });
    }

    callback({ ok: true });
  });

  socket.on("terminal-data", async (data) => {
    const sid = socket.data.attachedSessionId;
    if (!sid) return;

    const backend = getPtyBackend(sid);
    if (!backend) return;

    let forwarded: boolean;
    try {
      forwarded = await commandInterceptor.intercept(
        sid,
        data,
        (approval) =>
          io.to(`session:${sid}`).emit("interceptor-pending", approval),
        (warning) => io.to(`session:${sid}`).emit("interceptor-warn", warning),
      );
    } catch (err) {
      console.error(
        "[terminal-data] interceptor error, forwarding anyway:",
        err,
      );
      forwarded = true;
    }

    if (forwarded) {
      sessionManager.bufferActivity(sid);
      void agentRunLedger
        .appendEventBySession(
          sid,
          "terminal-input",
          createTerminalIoPayload("input", data),
          "socket",
        )
        .catch((err) => {
          console.error("[AgentRunLedger] failed to record input:", err);
        });
      backend.write(sid, data);

      // Auto-rename session based on user input (fire-and-forget)
      if (data.includes("\r") || data.includes("\n")) {
        void sessionManager.autoRenameFromInput(sid, data);
      }
    }
  });

  socket.on("terminal-resize", ({ cols, rows }) => {
    const sid = socket.data.attachedSessionId;
    if (sid) {
      const backend = getPtyBackend(sid);
      if (backend) backend.resize(sid, cols, rows);
    }
  });

  socket.on("session-detach", () => {
    const sid = socket.data.attachedSessionId;
    if (sid) {
      commandInterceptor.cancelPendingApprovals(sid);
      commandInterceptor.clearBuffer(sid);
    }
    detach();
  });

  socket.on("session-list", async (projectId, callback) => {
    const sessions = await sessionManager.listSessions(projectId ?? undefined);
    callback(
      sessions.map((session) => {
        const backend = getPtyBackend(session.id);
        if (!backend) {
          return session;
        }

        const preview = backend.getScreenPreview(session.id);
        return {
          ...session,
          lastContext: preview || session.lastContext,
        };
      }),
    );
  });

  socket.on("dashboard-join", () => {
    void socket.join("dashboard");
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] disconnected: ${socket.id}`);
    detach();
  });
}
