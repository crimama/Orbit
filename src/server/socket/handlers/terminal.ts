import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { ptyManager } from "@/server/pty/ptyManager";
import { getPtyBackend } from "@/server/pty/ptyBackend";
import { commandInterceptor } from "@/server/pty/interceptor";
import { sessionManager } from "@/server/session/sessionManager";
import { compressIfNeeded, DeltaBatcher } from "@/server/ssh/deltaStream";
import type { SessionInfo } from "@/lib/types";

export function registerTerminalHandlers(
  io: OrbitServer,
  socket: OrbitSocket,
): void {
  let unsubData: (() => void) | null = null;
  let unsubExit: (() => void) | null = null;
  let unsubReady: (() => void) | null = null;
  let batcher: DeltaBatcher | null = null;
  let sessionRoom: string | null = null;

  function detach() {
    if (sessionRoom) {
      socket.leave(sessionRoom);
      sessionRoom = null;
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
    const existingBackend = getPtyBackend(sessionId);
    const running =
      existingBackend !== null ||
      (await sessionManager.ensureSessionRunning(sessionId));

    if (!running) {
      callback({ ok: false, error: "Session not found or not running" });
      return;
    }

    socket.data.attachedSessionId = sessionId;
    sessionRoom = `session:${sessionId}`;
    await socket.join(sessionRoom);

    // Re-lookup backend after ensureSessionRunning may have created it
    const backend = getPtyBackend(sessionId) ?? ptyManager;

    // Helper: start streaming scrollback + live data once ready
    function startStreaming() {
      const scrollback = backend.getScrollback(sessionId);
      if (scrollback) {
        const result = compressIfNeeded(scrollback);
        if (result.compressed) {
          socket.emit("terminal-data-compressed", result.payload as Buffer);
        } else {
          socket.emit("terminal-data", result.payload as string);
        }
      }

      batcher = new DeltaBatcher((payload, compressed) => {
        if (compressed) {
          socket.emit("terminal-data-compressed", payload as Buffer);
        } else {
          socket.emit("terminal-data", payload as string);
        }
      });

      unsubData = backend.onData(sessionId, (data) => {
        batcher!.push(data);
      });

      socket.emit("session-ready", sessionId);
    }

    unsubExit = backend.onExit(sessionId, async (exitCode) => {
      const preview = backend.getScreenPreview(sessionId);
      socket.emit("session-exit", sessionId, exitCode);
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
    if (backend.isReady(sessionId)) {
      startStreaming();
    } else {
      unsubReady = backend.onReady(sessionId, () => {
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
        (approval) => io.to(`session:${sid}`).emit("interceptor-pending", approval),
        (warning) => io.to(`session:${sid}`).emit("interceptor-warn", warning),
      );
    } catch (err) {
      console.error("[terminal-data] interceptor error, forwarding anyway:", err);
      forwarded = true;
    }

    if (forwarded) {
      sessionManager.bufferActivity(sid);
      backend.write(sid, data);
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
    if (sid) commandInterceptor.clearBuffer(sid);
    detach();
  });

  socket.on("session-list", async (projectId, callback) => {
    const sessions = await sessionManager.listSessions(
      projectId ?? undefined,
    );
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
