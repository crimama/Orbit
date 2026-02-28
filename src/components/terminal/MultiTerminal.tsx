"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  createLeaf,
  splitPane,
  closePane,
  updateLeafSession,
  updateSplitRatio,
  findLeaf,
  collectLeafIds,
  type PaneNode,
} from "@/lib/paneTree";
import { createTerminalSocket, type OrbitSocket } from "@/lib/socketClient";
import type {
  SessionInfo,
  ApiResponse,
  WorkspaceLayoutInfo,
  CreateWorkspaceLayoutRequest,
  UpdateWorkspaceLayoutRequest,
} from "@/lib/types";
import PaneRenderer from "./PaneRenderer";

interface MultiTerminalProps {
  initialSessionId: string | null;
  initialWorkspaceId?: string | null;
  onKillSession?: (sessionId: string) => Promise<void> | void;
}

function isPaneNode(value: unknown): value is PaneNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<PaneNode>;

  if (node.type === "leaf") {
    return (
      typeof node.id === "string" &&
      (typeof node.sessionId === "string" || node.sessionId === null)
    );
  }

  if (node.type === "split") {
    const split = value as {
      id?: unknown;
      direction?: unknown;
      ratio?: unknown;
      children?: unknown;
    };
    return (
      typeof split.id === "string" &&
      (split.direction === "horizontal" || split.direction === "vertical") &&
      typeof split.ratio === "number" &&
      Array.isArray(split.children) &&
      split.children.length === 2 &&
      isPaneNode(split.children[0]) &&
      isPaneNode(split.children[1])
    );
  }

  return false;
}

function sanitizeTreeSessions(
  node: PaneNode,
  sessionIds: Set<string>,
): PaneNode {
  if (node.type === "leaf") {
    if (!node.sessionId || sessionIds.has(node.sessionId)) {
      return node;
    }
    return { ...node, sessionId: null };
  }

  return {
    ...node,
    children: [
      sanitizeTreeSessions(node.children[0], sessionIds),
      sanitizeTreeSessions(node.children[1], sessionIds),
    ],
  };
}

function reorientSiblingLeafSplit(
  node: PaneNode,
  sourcePaneId: string,
  targetPaneId: string,
  position: "top" | "bottom" | "left" | "right",
): { node: PaneNode; changed: boolean } {
  if (node.type === "leaf") return { node, changed: false };

  const [first, second] = node.children;
  const isSiblingLeafPair =
    first.type === "leaf" &&
    second.type === "leaf" &&
    ((first.id === sourcePaneId && second.id === targetPaneId) ||
      (first.id === targetPaneId && second.id === sourcePaneId));

  if (isSiblingLeafPair) {
    const direction =
      position === "top" || position === "bottom" ? "vertical" : "horizontal";
    const firstId =
      position === "top" || position === "left" ? sourcePaneId : targetPaneId;
    const secondId = firstId === sourcePaneId ? targetPaneId : sourcePaneId;
    const byId = new Map([
      [first.id, first],
      [second.id, second],
    ]);

    return {
      node: {
        ...node,
        direction,
        children: [byId.get(firstId)!, byId.get(secondId)!],
      },
      changed: true,
    };
  }

  const left = reorientSiblingLeafSplit(
    node.children[0],
    sourcePaneId,
    targetPaneId,
    position,
  );
  if (left.changed) {
    return {
      node: { ...node, children: [left.node, node.children[1]] },
      changed: true,
    };
  }

  const right = reorientSiblingLeafSplit(
    node.children[1],
    sourcePaneId,
    targetPaneId,
    position,
  );
  if (right.changed) {
    return {
      node: { ...node, children: [node.children[0], right.node] },
      changed: true,
    };
  }

  return { node, changed: false };
}

function placeNewSessionByEdge(
  node: PaneNode,
  paneId: string,
  position: "top" | "bottom" | "left" | "right",
): { node: PaneNode; changed: boolean } {
  if (node.type === "leaf") return { node, changed: false };

  const [first, second] = node.children;
  const isTargetSplit =
    first.type === "leaf" &&
    second.type === "leaf" &&
    (first.id === paneId || second.id === paneId);

  if (isTargetSplit) {
    const targetFirst = position === "left" || position === "top";
    const paneOnFirst = first.type === "leaf" && first.id === paneId;
    if (targetFirst === paneOnFirst) {
      return { node, changed: true };
    }
    return {
      node: { ...node, children: [second, first] },
      changed: true,
    };
  }

  const left = placeNewSessionByEdge(node.children[0], paneId, position);
  if (left.changed) {
    return {
      node: { ...node, children: [left.node, node.children[1]] },
      changed: true,
    };
  }

  const right = placeNewSessionByEdge(node.children[1], paneId, position);
  if (right.changed) {
    return {
      node: { ...node, children: [node.children[0], right.node] },
      changed: true,
    };
  }

  return { node, changed: false };
}

export default function MultiTerminal({
  initialSessionId,
  initialWorkspaceId,
  onKillSession,
}: MultiTerminalProps) {
  // Pane tree state
  const [tree, setTree] = useState<PaneNode>(() => {
    const leaf = createLeaf(initialSessionId);
    return leaf;
  });
  const [activePaneId, setActivePaneId] = useState(() => tree.id);

  // Socket map: paneId → OrbitSocket
  const socketsRef = useRef<Map<string, OrbitSocket>>(new Map());
  const [socketStates, setSocketStates] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Per-pane exit tracking
  const [exitedPanes, setExitedPanes] = useState<Set<string>>(new Set());

  // Sessions list
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceLayoutInfo[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const workspaceStorageKey = "orbit:last-workspace:global";

  // Fetch sessions
  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        const url = "/api/sessions";
        const res = await fetch(url);
        const json = (await res.json()) as ApiResponse<SessionInfo[]>;
        if (!cancelled && "data" in json) {
          setSessions((prev) => {
            const next = json.data;
            if (
              prev.length === next.length &&
              prev.every(
                (p, i) => p.id === next[i].id && p.status === next[i].status,
              )
            ) {
              return prev;
            }
            return next;
          });
        }
      } catch {}
    }

    fetchSessions();
    const timer = setInterval(fetchSessions, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      const json = (await res.json()) as ApiResponse<WorkspaceLayoutInfo[]>;
      if ("data" in json) {
        setWorkspaces(json.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  const applyWorkspace = useCallback(
    (workspace: WorkspaceLayoutInfo) => {
      try {
        const parsed = JSON.parse(workspace.tree) as unknown;
        if (!isPaneNode(parsed)) return;

        const activeSessionIds = new Set(
          sessions.filter((s) => s.status === "active").map((s) => s.id),
        );
        const sanitizedTree = sanitizeTreeSessions(parsed, activeSessionIds);
        const leafIds = collectLeafIds(sanitizedTree);
        const nextActivePane =
          workspace.activePaneId && leafIds.includes(workspace.activePaneId)
            ? workspace.activePaneId
            : leafIds[0];

        setTree(sanitizedTree);
        if (nextActivePane) setActivePaneId(nextActivePane);
        setWorkspaceName(workspace.name);
        setSelectedWorkspaceId(workspace.id);
        localStorage.setItem(workspaceStorageKey, workspace.id);
      } catch {}
    },
    [sessions, workspaceStorageKey],
  );

  useEffect(() => {
    if (workspaces.length === 0) return;
    const pinnedId =
      initialWorkspaceId?.trim() || localStorage.getItem(workspaceStorageKey);
    if (!pinnedId) return;
    const found = workspaces.find((w) => w.id === pinnedId);
    if (found) {
      applyWorkspace(found);
    }
  }, [workspaces, workspaceStorageKey, applyWorkspace, initialWorkspaceId]);

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
        if (collectLeafIds(prev).length === 1) {
          return updateLeafSession(prev, paneId, null);
        }
        const result = closePane(prev, paneId);
        return result ?? prev;
      });
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
      setExitedPanes((prev) => {
        if (!prev.has(paneId)) return prev;
        const next = new Set(prev);
        next.delete(paneId);
        return next;
      });
    },
    [],
  );

  const handleDropSession = useCallback(
    (
      paneId: string,
      sessionId: string,
      position: "top" | "bottom" | "left" | "right" | "center",
    ) => {
      if (position === "center") {
        setTree((prev) => updateLeafSession(prev, paneId, sessionId));
      } else {
        const direction =
          position === "top" || position === "bottom"
            ? "vertical"
            : "horizontal";
        setTree((prev) => {
          const split = splitPane(prev, paneId, direction, sessionId);
          const placed = placeNewSessionByEdge(split, paneId, position);
          return placed.node;
        });
      }

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

  const handleRatioChange = useCallback((splitId: string, ratio: number) => {
    setTree((prev) => updateSplitRatio(prev, splitId, ratio));
  }, []);

  const handleSwapPanes = useCallback(
    (sourcePaneId: string, targetPaneId: string) => {
      if (sourcePaneId === targetPaneId) return;

      setTree((prev) => {
        const sourceLeaf = findLeaf(prev, sourcePaneId);
        const targetLeaf = findLeaf(prev, targetPaneId);
        if (!sourceLeaf || !targetLeaf) return prev;

        let next = updateLeafSession(prev, sourcePaneId, targetLeaf.sessionId);
        next = updateLeafSession(next, targetPaneId, sourceLeaf.sessionId);
        return next;
      });

      setExitedPanes((prev) => {
        if (!prev.has(sourcePaneId) && !prev.has(targetPaneId)) return prev;
        const next = new Set(prev);
        next.delete(sourcePaneId);
        next.delete(targetPaneId);
        return next;
      });
    },
    [],
  );

  const handleMovePane = useCallback(
    (
      sourcePaneId: string,
      targetPaneId: string,
      position: "top" | "bottom" | "left" | "right",
    ) => {
      if (sourcePaneId === targetPaneId) return;
      setTree((prev) => {
        const next = reorientSiblingLeafSplit(
          prev,
          sourcePaneId,
          targetPaneId,
          position,
        );
        if (next.changed) return next.node;

        const sourceLeaf = findLeaf(prev, sourcePaneId);
        const targetLeaf = findLeaf(prev, targetPaneId);
        if (!sourceLeaf || !targetLeaf) return prev;

        let swapped = updateLeafSession(
          prev,
          sourcePaneId,
          targetLeaf.sessionId,
        );
        swapped = updateLeafSession(
          swapped,
          targetPaneId,
          sourceLeaf.sessionId,
        );
        return swapped;
      });

      setExitedPanes((prev) => {
        if (!prev.has(sourcePaneId) && !prev.has(targetPaneId)) return prev;
        const next = new Set(prev);
        next.delete(sourcePaneId);
        next.delete(targetPaneId);
        return next;
      });
    },
    [],
  );

  const handleKillSession = useCallback(
    async (paneId: string, sessionId: string) => {
      if (onKillSession) {
        await onKillSession(sessionId);
      } else {
        await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      }
      setTree((prev) => updateLeafSession(prev, paneId, null));
      setExitedPanes((prev) => {
        if (!prev.has(paneId)) return prev;
        const next = new Set(prev);
        next.delete(paneId);
        return next;
      });
    },
    [onKillSession],
  );

  const saveWorkspace = useCallback(async () => {
    setSavingWorkspace(true);
    try {
      const name =
        workspaceName.trim() || `Workspace ${new Date().toLocaleString()}`;
      if (selectedWorkspaceId) {
        const body: UpdateWorkspaceLayoutRequest = {
          name,
          tree: JSON.stringify(tree),
          activePaneId,
        };
        const res = await fetch(`/api/workspaces/${selectedWorkspaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as ApiResponse<WorkspaceLayoutInfo>;
        if ("data" in json) {
          setWorkspaceName(json.data.name);
          localStorage.setItem(workspaceStorageKey, json.data.id);
        }
      } else {
        const body: CreateWorkspaceLayoutRequest = {
          name,
          tree: JSON.stringify(tree),
          activePaneId,
        };
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as ApiResponse<WorkspaceLayoutInfo>;
        if ("data" in json) {
          setSelectedWorkspaceId(json.data.id);
          setWorkspaceName(json.data.name);
          localStorage.setItem(workspaceStorageKey, json.data.id);
        }
      }
      await fetchWorkspaces();
    } finally {
      setSavingWorkspace(false);
    }
  }, [
    workspaceName,
    selectedWorkspaceId,
    tree,
    activePaneId,
    workspaceStorageKey,
    fetchWorkspaces,
  ]);

  const deleteWorkspace = useCallback(async () => {
    if (!selectedWorkspaceId) return;
    await fetch(`/api/workspaces/${selectedWorkspaceId}`, {
      method: "DELETE",
    });
    setSelectedWorkspaceId("");
    setWorkspaceName("");
    localStorage.removeItem(workspaceStorageKey);
    await fetchWorkspaces();
  }, [selectedWorkspaceId, workspaceStorageKey, fetchWorkspaces]);

  const leafCount = collectLeafIds(tree).length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <select
          value={selectedWorkspaceId}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedWorkspaceId(id);
            const found = workspaces.find((w) => w.id === id);
            if (found) {
              applyWorkspace(found);
            }
          }}
          className="min-w-40 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <option value="">Unsaved workspace</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder="Workspace name"
          className="min-w-40 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
        />
        <button
          type="button"
          onClick={() => void saveWorkspace()}
          disabled={savingWorkspace}
          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {savingWorkspace ? "Saving..." : "Save Workspace"}
        </button>
        <button
          type="button"
          onClick={() => {
            const found = workspaces.find((w) => w.id === selectedWorkspaceId);
            if (found) {
              applyWorkspace(found);
            }
          }}
          disabled={!selectedWorkspaceId}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
        >
          Reopen
        </button>
        <button
          type="button"
          onClick={() => void deleteWorkspace()}
          disabled={!selectedWorkspaceId}
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      <div className="min-h-0 flex-1">
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
          onDropSession={handleDropSession}
          onSwapPanes={handleSwapPanes}
          onMovePane={handleMovePane}
          onRatioChange={handleRatioChange}
          onPaneExit={handlePaneExit}
          onKillSession={handleKillSession}
        />
      </div>
    </div>
  );
}
