import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { commandInterceptor } from "@/server/pty/interceptor";
import {
  seedInterceptorRules,
  setInterceptorMode,
} from "@/server/pty/interceptorRules";
import { getPtyBackend } from "@/server/pty/ptyBackend";
import type { InterceptorMode } from "@/lib/types";

const VALID_MODES: InterceptorMode[] = ["blacklist", "allowlist", "hybrid", "yolo"];

let rulesSeeded = false;

export function registerInterceptorHandlers(
  io: OrbitServer,
  socket: OrbitSocket,
): void {
  // Seed default rules on first connection
  if (!rulesSeeded) {
    seedInterceptorRules()
      .then(() => {
        rulesSeeded = true;
      })
      .catch((err) => {
        console.error("[Interceptor] Failed to seed rules:", err);
      });
  }

  socket.on("interceptor-approve", (approvalId) => {
    const result = commandInterceptor.resolve(approvalId, true);
    if (result) {
      // Forward the held data to the PTY
      const backend = getPtyBackend(result.sessionId);
      if (backend) {
        backend.write(result.sessionId, result.data);
      }
      io.to(`session:${result.sessionId}`).emit("interceptor-resolved", approvalId, true);
      return;
    }
    socket.emit("interceptor-resolved", approvalId, true);
  });

  socket.on("interceptor-deny", (approvalId) => {
    const pending = commandInterceptor.getPendingById(approvalId);
    commandInterceptor.resolve(approvalId, false);
    if (pending) {
      io.to(`session:${pending.sessionId}`).emit(
        "interceptor-resolved",
        approvalId,
        false,
      );
      return;
    }
    socket.emit("interceptor-resolved", approvalId, false);
  });

  // Global interceptor mode change (same process = correct instance)
  socket.on("set-interceptor-mode", async (mode, callback) => {
    if (!VALID_MODES.includes(mode)) {
      callback({ ok: false, mode: "hybrid" });
      return;
    }
    await setInterceptorMode(mode);
    commandInterceptor.setGlobalModeDirect(mode);
    io.emit("interceptor-mode-changed", mode);
    callback({ ok: true, mode });
  });

  // Per-session mode change
  socket.on("set-session-mode", (sessionId, mode, callback) => {
    if (mode !== null && !VALID_MODES.includes(mode)) {
      callback({ ok: false });
      return;
    }
    commandInterceptor.setSessionMode(sessionId, mode);
    io.to(`session:${sessionId}`).emit("session-mode-changed", sessionId, mode);
    // Also notify dashboard watchers
    io.to("dashboard").emit("session-mode-changed", sessionId, mode);
    callback({ ok: true });
  });

  // Query per-session mode
  socket.on("get-session-mode", (sessionId, callback) => {
    callback(commandInterceptor.getSessionMode(sessionId));
  });
}
