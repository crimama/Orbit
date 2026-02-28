import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { commandInterceptor } from "@/server/pty/interceptor";
import { seedInterceptorRules } from "@/server/pty/interceptorRules";
import { getPtyBackend } from "@/server/pty/ptyBackend";

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
}
