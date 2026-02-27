import { createServer } from "http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { registerSocketHandlers } from "@/server/socket/handler";
import { sessionManager } from "@/server/session/sessionManager";
import { sshManager } from "@/server/ssh/sshManager";
import { SOCKET_PATH, DEFAULT_PORT } from "@/lib/constants";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "@/lib/types";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

async function main() {
  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();
  await sessionManager.reconcileOnStartup();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    path: SOCKET_PATH,
    cors: {
      origin: dev ? "*" : false,
    },
  });

  registerSocketHandlers(io);
  sessionManager.startGC();

  httpServer.listen(port, () => {
    console.log(`> Agent Orbit running on http://localhost:${port}`);
    console.log(`> Socket.io path: ${SOCKET_PATH}`);
    console.log(`> Mode: ${dev ? "development" : "production"}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n> Shutting down...");
    sessionManager.stopGC();
    sshManager.disconnectAll();
    io.close();
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
