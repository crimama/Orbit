"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  createLeaf,
  splitPane,
  closePane,
  updateLeafSession,
  updateSplitRatio,
  collectLeafIds,
  type PaneNode,
} from "@/lib/paneTree";
import { createTerminalSocket, type OrbitSocket } from "@/lib/socketClient";
import type { SessionInfo, ApiResponse } from "@/lib/types";
import PaneRenderer from "./PaneRenderer";

interface MultiTerminalProps {
  initialSessionId: string;
  projectId?: string;
}

export default function MultiTerminal({
  initialSessionId,
  projectId,
}: MultiTerminalProps) {
  // Pane tree state
  const [tree, setTree] = useState<PaneNode>(() => {
    const leaf = createLeaf(initialSessionId);
    return leaf;
  });
  const [activePaneId, setActivePaneId] = useState(() => tree.id);

  // Socket map: paneId → OrbitSocket
  const socketsRef = useRef<Map<string, OrbitSocket>>(new Map());
  const [socketStates, setSocketStates] = useState<Map<string, boolean>>(new Map());

  // Per-pane exit tracking
  const [exitedPanes, setExitedPanes] = useState<Set<string>>(new Set());

  // Sessions list
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  // Fetch sessions
  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        const url = projectId
          ? `/api/sessions?projectId=${projectId}`
          : "/api/sessions";
        const res = await fetch(url);
        const json = (await res.json()) as ApiResponse<SessionInfo[]>;
        if (!cancelled && "data" in json) {
          setSessions((prev) => {
            const next = json.data;
            if (
              prev.length === next.length &&
              prev.every((p, i) => p.id === next[i].id && p.status === next[i].status)
            ) {
              return prev;
            }
            return next;
          });
        }
      } catch {
        // Ignore
      }
    }

    fetchSessions();
    const timer = setInterval(fetchSessions, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId]);

  // Ensure sockets exist for all leaves
  const ensureSocket = useCallback((paneId: string) => {
    if (socketsRef.current.has(paneId)) return;
    const sock = createTerminalSocket();

    socketsRef.current.set(paneId, sock);

    sock.on("connect", () => {
      setSocketStates((prev) => new Map(prev).set(paneId, true));
    });
    sock.on("disconnect", () => {
      setSocketStates((prev) => new Map(prev).set(paneId, false));
    });
    if (sock.connected) {
      setSocketStates((prev) => new Map(prev).set(paneId, true));
    }
  }, []);

  const destroySocket = useCallback((paneId: string) => {
    const sock = socketsRef.current.get(paneId);
    if (sock) {
      sock.disconnect();
      socketsRef.current.delete(paneId);
      setSocketStates((prev) => {
        const next = new Map(prev);
        next.delete(paneId);
        return next;
      });
    }
  }, []);

  // Sync sockets with tree leaves
  useEffect(() => {
    const leafIds = new Set(collectLeafIds(tree));

    // Create sockets for new leaves
    for (const id of Array.from(leafIds)) {
      ensureSocket(id);
    }

    // Destroy sockets for removed leaves
    for (const id of Array.from(socketsRef.current.keys())) {
      if (!leafIds.has(id)) {
        destroySocket(id);
      }
    }
  }, [tree, ensureSocket, destroySocket]);

  // Cleanup all sockets on unmount
  useEffect(() => {
    const sockets = socketsRef.current;
    return () => {
      for (const sock of Array.from(sockets.values())) {
        sock.disconnect();
      }
      sockets.clear();
    };
  }, []);

  const handleSplit = useCallback(
    (paneId: string, direction: "horizontal" | "vertical") => {
      setTree((prev) => splitPane(prev, paneId, direction));
    },
    [],
  );

  const handleClose = useCallback(
    (paneId: string) => {
      setTree((prev) => {
        const result = closePane(prev, paneId);
        return result ?? prev; // should never be null if leafCount > 1
      });
      // If closing the active pane, pick another
      if (paneId === activePaneId) {
        setTree((current) => {
          const leaves = collectLeafIds(current);
          if (leaves.length > 0 && !leaves.includes(activePaneId)) {
            setActivePaneId(leaves[0]);
          }
          return current;
        });
      }
    },
    [activePaneId],
  );

  const handleSelectSession = useCallback(
    (paneId: string, sessionId: string) => {
      setTree((prev) => updateLeafSession(prev, paneId, sessionId));
      // Reset exit state when switching session
      setExitedPanes((prev) => {
        if (!prev.has(paneId)) return prev;
        const next = new Set(prev);
        next.delete(paneId);
        return next;
      });
    },
    [],
  );

  const handlePaneExit = useCallback((paneId: string) => {
    setExitedPanes((prev) => new Set(prev).add(paneId));
  }, []);

  const handleRatioChange = useCallback(
    (splitId: string, ratio: number) => {
      setTree((prev) => updateSplitRatio(prev, splitId, ratio));
    },
    [],
  );

  const leafCount = collectLeafIds(tree).length;

  return (
    <div className="flex h-full w-full flex-col">
      <PaneRenderer
        node={tree}
        activePaneId={activePaneId}
        sockets={socketsRef.current}
        socketStates={socketStates}
        sessions={sessions}
        leafCount={leafCount}
        exitedPanes={exitedPanes}
        onActivate={setActivePaneId}
        onSplit={handleSplit}
        onClose={handleClose}
        onSelectSession={handleSelectSession}
        onRatioChange={handleRatioChange}
        onPaneExit={handlePaneExit}
      />
    </div>
  );
}
