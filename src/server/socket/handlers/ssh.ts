import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { sshManager } from "@/server/ssh/sshManager";

export function registerSshHandlers(
  _io: OrbitServer,
  socket: OrbitSocket,
): void {
  // Forward SSH status changes to the connected client
  const unsubStatus = sshManager.onStatus((status) => {
    socket.emit("ssh-status", status);
  });

  socket.on("ssh-connect", async (configId, callback) => {
    try {
      await sshManager.connect(configId);
      callback({ ok: true });
    } catch (err) {
      callback({
        ok: false,
        error: err instanceof Error ? err.message : "SSH connection failed",
      });
    }
  });

  socket.on("ssh-disconnect", (configId) => {
    sshManager.disconnect(configId);
  });

  socket.on("ssh-status-request", (configId, callback) => {
    const status = sshManager.getStatus(configId);
    callback(status);
  });

  socket.on("disconnect", () => {
    unsubStatus();
  });
}
