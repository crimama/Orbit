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
    }
    // Notify all clients that the approval was resolved
    io.emit("interceptor-resolved", approvalId, true);
  });

  socket.on("interceptor-deny", (approvalId) => {
    commandInterceptor.resolve(approvalId, false);
    // Notify all clients that the approval was denied
    io.emit("interceptor-resolved", approvalId, false);
  });
}
