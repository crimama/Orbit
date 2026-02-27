import type { OrbitServer, OrbitSocket } from "@/server/socket/types";
import { graphManager } from "@/server/graph/graphManager";
import { startTrace } from "@/server/graph/traceDetector";

export function registerGraphHandlers(
  io: OrbitServer,
  socket: OrbitSocket,
): void {
  let cleanupTrace: (() => void) | null = null;

  function stopTrace() {
    if (cleanupTrace) {
      cleanupTrace();
      cleanupTrace = null;
    }
  }

  socket.on("graph-subscribe", async (projectId, callback) => {
    // Leave any previous graph room
    const prevProjectId = socket.data.subscribedGraphProjectId;
    if (prevProjectId) {
      socket.leave(`graph:${prevProjectId}`);
      stopTrace();
    }

    socket.data.subscribedGraphProjectId = projectId;
    await socket.join(`graph:${projectId}`);

    const state = await graphManager.getGraphState(projectId);
    callback(state);

    // Start trace if a session is attached
    const sessionId = socket.data.attachedSessionId;
    if (sessionId) {
      cleanupTrace = startTrace(sessionId, projectId, (trace) => {
        io.to(`graph:${projectId}`).emit("skill-trace", trace);
      });
    }
  });

  socket.on("graph-unsubscribe", (projectId) => {
    socket.leave(`graph:${projectId}`);
    if (socket.data.subscribedGraphProjectId === projectId) {
      socket.data.subscribedGraphProjectId = null;
    }
    stopTrace();
  });

  // When a session is attached and graph is already subscribed, start trace
  socket.on("session-attach", () => {
    // The terminal handler processes session-attach first.
    // We start tracing after attach succeeds — check on next tick
    // to let the terminal handler run its callback.
    process.nextTick(() => {
      const sessionId = socket.data.attachedSessionId;
      const projectId = socket.data.subscribedGraphProjectId;
      if (sessionId && projectId && !cleanupTrace) {
        cleanupTrace = startTrace(sessionId, projectId, (trace) => {
          io.to(`graph:${projectId}`).emit("skill-trace", trace);
        });
      }
    });
  });

  socket.on("session-detach", () => {
    stopTrace();
  });

  socket.on("disconnect", () => {
    stopTrace();
    socket.data.subscribedGraphProjectId = null;
  });
}
