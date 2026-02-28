import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { startEventExtraction } from "@/server/observability/eventExtractor";
import { sessionMetricsManager } from "@/server/observability/sessionMetrics";
import { OBS_METRICS_BROADCAST_INTERVAL_MS } from "@/lib/constants";

export function registerObservabilityHandlers(
  io: OrbitServer,
  socket: OrbitSocket,
): void {
  let cleanupExtraction: (() => void) | null = null;
  let broadcastTimer: ReturnType<typeof setInterval> | null = null;

  function stopExtraction() {
    if (cleanupExtraction) {
      cleanupExtraction();
      cleanupExtraction = null;
    }
    if (broadcastTimer) {
      clearInterval(broadcastTimer);
      broadcastTimer = null;
    }
  }

  function startMetrics(sessionId: string) {
    if (cleanupExtraction) return; // already active

    cleanupExtraction = startEventExtraction(sessionId, (event) => {
      const snapshot = sessionMetricsManager.record(event);
      io.to(`metrics:${sessionId}`).emit("session-event", event);
      io.to(`metrics:${sessionId}`).emit("session-metrics", snapshot);
    });

    // Periodic broadcast for duration updates
    broadcastTimer = setInterval(() => {
      const snapshot = sessionMetricsManager.getSnapshot(sessionId);
      io.to(`metrics:${sessionId}`).emit("session-metrics", snapshot);
    }, OBS_METRICS_BROADCAST_INTERVAL_MS);
  }

  socket.on("metrics-subscribe", async (sessionId, callback) => {
    // Leave previous metrics room
    const prev = socket.data.subscribedMetricsSessionId;
    if (prev) {
      socket.leave(`metrics:${prev}`);
      stopExtraction();
    }

    socket.data.subscribedMetricsSessionId = sessionId;
    await socket.join(`metrics:${sessionId}`);

    // Start extraction if session is already attached
    if (socket.data.attachedSessionId === sessionId) {
      startMetrics(sessionId);
    }

    const snapshot = sessionMetricsManager.getSnapshot(sessionId);
    callback(snapshot);
  });

  socket.on("metrics-unsubscribe", (sessionId) => {
    socket.leave(`metrics:${sessionId}`);
    if (socket.data.subscribedMetricsSessionId === sessionId) {
      socket.data.subscribedMetricsSessionId = null;
    }
    stopExtraction();
  });

  // Auto-start extraction when session is attached and metrics subscribed
  socket.on("session-attach", () => {
    process.nextTick(() => {
      const sessionId = socket.data.attachedSessionId;
      const metricsSessionId = socket.data.subscribedMetricsSessionId;
      if (sessionId && metricsSessionId === sessionId && !cleanupExtraction) {
        startMetrics(sessionId);
      }
    });
  });

  socket.on("session-detach", () => {
    stopExtraction();
  });

  socket.on("disconnect", () => {
    stopExtraction();
    socket.data.subscribedMetricsSessionId = null;
  });
}
