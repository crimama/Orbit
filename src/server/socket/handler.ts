import type { OrbitServer, SocketHandlerRegistrar } from "@/server/socket/types";
import { registerTerminalHandlers } from "@/server/socket/handlers/terminal";
import { registerSshHandlers } from "@/server/socket/handlers/ssh";
import { registerGraphHandlers } from "@/server/socket/handlers/graph";
import { registerInterceptorHandlers } from "@/server/socket/handlers/interceptor";

const registrars: SocketHandlerRegistrar[] = [
  registerTerminalHandlers,
  registerSshHandlers,
  registerGraphHandlers,
  registerInterceptorHandlers,
];

export function registerSocketHandlers(io: OrbitServer): void {
  io.on("connection", (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);
    socket.data.attachedSessionId = null;
    for (const reg of registrars) reg(io, socket);
  });
}
