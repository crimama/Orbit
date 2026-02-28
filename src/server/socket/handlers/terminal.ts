import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { ptyManager } from "@/server/pty/ptyManager";
import { getPtyBackend } from "@/server/pty/ptyBackend";
import { commandInterceptor } from "@/server/pty/interceptor";
import { sessionManager } from "@/server/session/sessionManager";
import { compressIfNeeded, DeltaBatcher } from "@/server/ssh/deltaStream";

export function registerTerminalHandlers(
  io: OrbitServer,
  socket: OrbitSocket,
): void {
  let unsubData: (() => void) | null = null;
  let unsubExit: (() => void) | null = null;
  let batcher: DeltaBatcher | null = null;
  let sessionRoom: string | null = null;

  function detach() {
    if (sessionRoom) {
      socket.leave(sessionRoom);
      sessionRoom = null;
    }
    batcher?.destroy();
    batcher = null;
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

    // Scrollback recovery — always attempt compression (can be up to 50KB)
    const scrollback = backend.getScrollback(sessionId);
    if (scrollback) {
      const result = compressIfNeeded(scrollback);
      if (result.compressed) {
        socket.emit("terminal-data-compressed", result.payload as Buffer);
      } else {
        socket.emit("terminal-data", result.payload as string);
      }
    }

    // Streaming data — batch small chunks + compress when beneficial
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
      (approval) => io.to(`session:${sid}`).emit("interceptor-pending", approval),
      (warning) => io.to(`session:${sid}`).emit("interceptor-warn", warning),
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
