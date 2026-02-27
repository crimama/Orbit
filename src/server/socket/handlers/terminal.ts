import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { ptyManager } from "@/server/pty/ptyManager";
import { getPtyBackend } from "@/server/pty/ptyBackend";
import { commandInterceptor } from "@/server/pty/interceptor";
import { sessionManager } from "@/server/session/sessionManager";

export function registerTerminalHandlers(
  io: OrbitServer,
  socket: OrbitSocket,
): void {
  let unsubData: (() => void) | null = null;
  let unsubExit: (() => void) | null = null;

  function detach() {
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

    // Re-lookup backend after ensureSessionRunning may have created it
    const backend = getPtyBackend(sessionId) ?? ptyManager;

    const scrollback = backend.getScrollback(sessionId);
    if (scrollback) {
      socket.emit("terminal-data", scrollback);
    }

    unsubData = backend.onData(sessionId, (data) => {
      socket.emit("terminal-data", data);
    });

    unsubExit = backend.onExit(sessionId, (exitCode) => {
      socket.emit("session-exit", sessionId, exitCode);
      detach();
    });

    callback({ ok: true });
  });

  socket.on("terminal-data", async (data) => {
    const sid = socket.data.attachedSessionId;
    if (!sid) return;

    const backend = getPtyBackend(sid);
    if (!backend) return;

    const forwarded = await commandInterceptor.intercept(
      sid,
      data,
      (approval) => io.emit("interceptor-pending", approval),
      (warning) => io.emit("interceptor-warn", warning),
    );

    if (forwarded) {
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
    callback(sessions);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] disconnected: ${socket.id}`);
    detach();
  });
}
