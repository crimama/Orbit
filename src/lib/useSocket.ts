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

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (backgrounded) {
      socket.disconnect();
      setConnected(false);
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }
  }, [backgrounded]);

  return { socket: socketRef.current, connected, backgrounded };
}
