"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/useSocket";
import type { SessionMetricsSnapshot, SessionEvent } from "@/lib/types";

export function useSessionMetrics(sessionId: string | null) {
  const { socket, connected } = useSocket();
  const [snapshot, setSnapshot] = useState<SessionMetricsSnapshot | null>(null);

  useEffect(() => {
    if (!socket || !connected || !sessionId) return;

    socket.emit("metrics-subscribe", sessionId, (initial) => {
      setSnapshot(initial);
    });

    function onMetrics(s: SessionMetricsSnapshot) {
      setSnapshot(s);
    }

    function onEvent(event: SessionEvent) {
      setSnapshot((prev) => {
        if (!prev) return prev;
        // Append the new event to recentEvents
        const recent = [...prev.recentEvents, event];
        if (recent.length > 50) recent.shift();
        return { ...prev, recentEvents: recent };
      });
    }

    socket.on("session-metrics", onMetrics);
    socket.on("session-event", onEvent);

    return () => {
      socket.off("session-metrics", onMetrics);
      socket.off("session-event", onEvent);
      socket.emit("metrics-unsubscribe", sessionId);
    };
  }, [socket, connected, sessionId]);

  return snapshot;
}
