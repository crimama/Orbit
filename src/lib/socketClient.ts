import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/lib/types";
import { SOCKET_PATH } from "@/lib/constants";

export type OrbitSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: OrbitSocket | null = null;

export function getSocket(): OrbitSocket {
  if (!socket) {
    socket = io({
      path: SOCKET_PATH,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

/** Create an independent Socket.io instance for a terminal pane. */
export function createTerminalSocket(): OrbitSocket {
  return io({
    path: SOCKET_PATH,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
