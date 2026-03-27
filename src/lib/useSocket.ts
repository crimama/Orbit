"use client";

import { useEffect, useRef, useState } from "react";
import { usePageVisibility } from "@/lib/hooks/usePageVisibility";
import { getSocket, type OrbitSocket } from "@/lib/socketClient";

export function useSocket() {
  const socketRef = useRef<OrbitSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const { backgrounded } = usePageVisibility();

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    function onConnectError(err: Error) {
      const msg = err.message?.toLowerCase() ?? "";
      if (msg.includes("unauthorized") || msg.includes("auth") || msg.includes("token")) {
        window.location.href = "/login";
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (backgrounded) {
      // Don't destroy the socket — just disconnect transport.
      // The 5-minute delay in usePageVisibility already gates this.
      if (socket.connected) {
        socket.disconnect();
        setConnected(false);
      }
      return;
    }

    // Returning from background — reconnect if needed
    if (!socket.connected) {
      socket.connect();
    }
  }, [backgrounded]);

  return { socket: socketRef.current, connected, backgrounded };
}
