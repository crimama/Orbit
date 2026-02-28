import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/lib/types";
import { SOCKET_PATH } from "@/lib/constants";

export type OrbitSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: OrbitSocket | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function getAccessToken(): string {
  return (
    readCookie("orbit_token")?.trim() ??
    process.env.NEXT_PUBLIC_ORBIT_ACCESS_TOKEN?.trim() ??
    ""
  );
}

function socketOptions() {
  return {
    path: SOCKET_PATH,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: (cb: (data: { token?: string }) => void) => {
      const token = getAccessToken();
      cb(token ? { token } : {});
    },
  };
}

export function getSocket(): OrbitSocket {
  if (!socket) {
    socket = io(socketOptions());
  }
  return socket;
}

/** Create an independent Socket.io instance for a terminal pane. */
export function createTerminalSocket(): OrbitSocket {
  return io(socketOptions());
}
