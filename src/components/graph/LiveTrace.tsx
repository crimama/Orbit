"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/lib/useSocket";
import type { SkillNodeStatus, SkillTrace } from "@/lib/types";

/** Auto-reset to idle after no trace update (ms) */
const AUTO_IDLE_MS = 5_000;

interface LiveTraceProps {
  onTraceUpdate: (skillId: string, status: SkillNodeStatus) => void;
}

export default function LiveTrace({ onTraceUpdate }: LiveTraceProps) {
  const { socket } = useSocket();
  const resetTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    if (!socket) return;

    const timers = resetTimers.current;

    function handleTrace(trace: SkillTrace) {
      onTraceUpdate(trace.skillId, trace.status);

      // Clear any existing reset timer for this skill
      const existing = timers.get(trace.skillId);
      if (existing) clearTimeout(existing);

      // Schedule auto-reset to idle if not already idle
      if (trace.status !== "idle") {
        const timer = setTimeout(() => {
          onTraceUpdate(trace.skillId, "idle");
          timers.delete(trace.skillId);
        }, AUTO_IDLE_MS);
        timers.set(trace.skillId, timer);
      }
    }

    socket.on("skill-trace", handleTrace);

    return () => {
      socket.off("skill-trace", handleTrace);
      // Clear all timers on cleanup
      for (const timer of Array.from(timers.values())) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [socket, onTraceUpdate]);

  // This is a headless component — renders nothing
  return null;
}
