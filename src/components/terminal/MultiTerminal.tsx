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
  migrateLegacyTree,
  syncCounterFromTree,
  type PaneNode,
} from "@/lib/paneTree";
import { createTerminalSocket, type OrbitSocket } from "@/lib/socketClient";
import type {
  SessionInfo,
  ApiResponse,
  WorkspaceLayoutInfo,
} from "@/lib/types";
import PaneRenderer from "./PaneRenderer";

const WORKSPACE_STORAGE_KEY = "orbit:last-workspace:global";

interface MultiTerminalProps {
  initialSessionId: string | null;
  /** When changed after mount, adds the session to an empty pane or creates a new split */
  requestedSessionId?: string | null;
  initialWorkspaceId?: string | null;
  autoRestoreWorkspace?: boolean;
  runtimeStorageKey?: string;
  onKillSession?: (sessionId: string) => Promise<void> | void;
  /** Called when the set of session IDs in panes changes */
  onPaneSessionsChange?: (sessionIds: string[]) => void;
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
    children: node.children.map((child) =>
      sanitizeTreeSessions(child, sessionIds),
    ),
  };
}

function reorientSiblingLeafSplit(
  node: PaneNode,
  sourcePaneId: string,
  targetPaneId: string,
  position: "top" | "bottom" | "left" | "right",
): { node: PaneNode; changed: boolean } {
  if (node.type === "leaf") return { node, changed: false };

  const leafChildren = node.children.filter(
    (child): child is Extract<PaneNode, { type: "leaf" }> => child.type === "leaf",
  );
  const isSiblingLeafPair =
    leafChildren.length === 2 &&
    ((leafChildren[0].id === sourcePaneId &&
      leafChildren[1].id === targetPaneId) ||
      (leafChildren[0].id === targetPaneId &&
        leafChildren[1].id === sourcePaneId));

  if (isSiblingLeafPair) {
    const direction =
      position === "top" || position === "bottom" ? "vertical" : "horizontal";
    const firstId =
      position === "top" || position === "left" ? sourcePaneId : targetPaneId;
    const secondId = firstId === sourcePaneId ? targetPaneId : sourcePaneId;
    const byId = new Map([
      [leafChildren[0].id, leafChildren[0]],
      [leafChildren[1].id, leafChildren[1]],
    ]);

    return {
      node: {
        ...node,
        direction,
        children: [byId.get(firstId)!, byId.get(secondId)!],
        ratios: [0.5, 0.5],
      },
      changed: true,
    };
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const next = reorientSiblingLeafSplit(
      node.children[index],
      sourcePaneId,
      targetPaneId,
      position,
    );
    if (next.changed) {
      const children = [...node.children];
      children[index] = next.node;
      return {
        node: { ...node, children },
        changed: true,
      };
    }
  }

  return { node, changed: false };
}

function placeNewSessionByEdge(
  node: PaneNode,
  paneId: string,
  position: "top" | "bottom" | "left" | "right",
): { node: PaneNode; changed: boolean } {
  if (node.type === "leaf") return { node, changed: false };

  const paneIndex = node.children.findIndex(
    (child) => child.type === "leaf" && child.id === paneId,
  );
  const isTargetSplit = paneIndex !== -1 && node.children.length >= 2;

  if (isTargetSplit) {
    const shouldMoveForward = position === "right" || position === "bottom";
    const swapIndex = shouldMoveForward ? paneIndex + 1 : paneIndex - 1;
    if (swapIndex < 0 || swapIndex >= node.children.length) {
      return { node, changed: false };
    }

    const children = [...node.children];
    [children[paneIndex], children[swapIndex]] = [
      children[swapIndex],
      children[paneIndex],
    ];
    return {
      node: { ...node, children },
      changed: true,
    };
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const next = placeNewSessionByEdge(
      node.children[index],
      paneId,
      position,
    );
    if (next.changed) {
      const children = [...node.children];
      children[index] = next.node;
      return {
        node: { ...node, children },
        changed: true,
      };
    }
  }

  return { node, changed: false };
}

export default function MultiTerminal({
  initialSessionId,
  requestedSessionId,
  initialWorkspaceId,
  autoRestoreWorkspace = true,
  runtimeStorageKey,
  onKillSession,
  onPaneSessionsChange,
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

  // Per-pane exit tracking (ref-only, no re-render needed)
  const exitedPanesRef = useRef<Set<string>>(new Set());

  // Notification ring: panes needing attention
  const [attentionPanes, setAttentionPanes] = useState<Set<string>>(new Set());

  // Sessions list
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const sessionsLoadedRef = useRef(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceLayoutInfo[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const runtimeStateLoadedRef = useRef(false);

  // Handle requestedSessionId — add session to existing tree without remounting
  const lastRequestedRef = useRef(requestedSessionId);
  useEffect(() => {
    if (!requestedSessionId || requestedSessionId === lastRequestedRef.current) return;
    lastRequestedRef.current = requestedSessionId;

    setTree((prev) => {
      // Check if session is already in a pane → focus it
      const leaves = collectLeafIds(prev);
      for (const leafId of leaves) {
        const leaf = findLeaf(prev, leafId);
        if (leaf?.sessionId === requestedSessionId) {
          setActivePaneId(leafId);
          return prev;
        }
      }

      // Find an empty pane (sessionId === null)
      for (const leafId of leaves) {
        const leaf = findLeaf(prev, leafId);
        if (leaf && !leaf.sessionId) {
          setActivePaneId(leafId);
          return updateLeafSession(prev, leafId, requestedSessionId);
        }
      }

      // No empty pane — replace session in active pane
      return updateLeafSession(prev, activePaneId, requestedSessionId);
    });
  }, [requestedSessionId, activePaneId]);

  // Notify parent of which sessions are in panes
  useEffect(() => {
    const leaves = collectLeafIds(tree);
    const sessionIds = leaves
      .map((id) => findLeaf(tree, id)?.sessionId)
      .filter((id): id is string => !!id);
    onPaneSessionsChange?.(sessionIds);
  }, [tree, onPaneSessionsChange]);

  // Auto-close panes for terminated sessions
  useEffect(() => {
    if (!sessionsLoadedRef.current) return;
    const activeIds = new Set(
      sessions.filter((s) => s.status === "active").map((s) => s.id),
    );
    const leaves = collectLeafIds(tree);
    for (const leafId of leaves) {
      const leaf = findLeaf(tree, leafId);
      if (leaf?.sessionId && !activeIds.has(leaf.sessionId)) {
        // Session is no longer active — clear the pane
        setTree((prev) => {
          if (collectLeafIds(prev).length <= 1) {
            return updateLeafSession(prev, leafId, null);
          }
          return closePane(prev, leafId) ?? prev;
        });
      }
    }
  }, [sessions, tree]);

  // Fetch sessions
  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        const url = "/api/sessions";
        const res = await fetch(url);
        const json = (await res.json()) as ApiResponse<SessionInfo[]>;
        if (!cancelled && "data" in json) {
          sessionsLoadedRef.current = true;
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

  useEffect(() => {
    if (!runtimeStorageKey) {
      runtimeStateLoadedRef.current = true;
      return;
    }
    if (runtimeStateLoadedRef.current) return;

    try {
      const raw = localStorage.getItem(
        `orbit:runtime-workspace:${runtimeStorageKey}`,
      );
      if (!raw) {
        runtimeStateLoadedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as {
        tree?: unknown;
        activePaneId?: string;
      };

      const migratedTree = migrateLegacyTree(parsed.tree);
      if (!migratedTree) {
        runtimeStateLoadedRef.current = true;
        return;
      }

      const leafIds = collectLeafIds(migratedTree);
      setTree(migratedTree);
      if (parsed.activePaneId && leafIds.includes(parsed.activePaneId)) {
        setActivePaneId(parsed.activePaneId);
      } else if (leafIds.length > 0) {
        setActivePaneId(leafIds[0]);
      }
    } catch (error) {
      void error;
    } finally {
      runtimeStateLoadedRef.current = true;
    }
  }, [runtimeStorageKey]);

  useEffect(() => {
    if (!runtimeStorageKey || !runtimeStateLoadedRef.current) return;

    try {
      localStorage.setItem(
        `orbit:runtime-workspace:${runtimeStorageKey}`,
        JSON.stringify({ tree, activePaneId }),
      );
    } catch (error) {
      void error;
    }
  }, [runtimeStorageKey, tree, activePaneId]);

  const applyWorkspace = useCallback(
    (workspace: WorkspaceLayoutInfo) => {
      try {
        const parsed = JSON.parse(workspace.tree) as unknown;
        const migratedTree = migrateLegacyTree(parsed);
        if (!migratedTree) return;
        syncCounterFromTree(migratedTree);

        const activeSessionIds = new Set(
          sessions.filter((s) => s.status === "active").map((s) => s.id),
        );
        const sanitizedTree = sanitizeTreeSessions(migratedTree, activeSessionIds);
        const leafIds = collectLeafIds(sanitizedTree);
        const nextActivePane =
          workspace.activePaneId && leafIds.includes(workspace.activePaneId)
            ? workspace.activePaneId
            : leafIds[0];

        setTree(sanitizedTree);
        if (nextActivePane) setActivePaneId(nextActivePane);
        setWorkspaceName(workspace.name);
        setSelectedWorkspaceId(workspace.id);
        localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
      } catch {}
    },
    [sessions],
  );

  useEffect(() => {
    if (workspaces.length === 0) return;
    if (!sessionsLoadedRef.current) return; // Wait until sessions are loaded
    const pinnedId =
      initialWorkspaceId?.trim() ||
      (autoRestoreWorkspace
        ? localStorage.getItem(WORKSPACE_STORAGE_KEY)
        : null);
    if (!pinnedId) return;
    const found = workspaces.find((w) => w.id === pinnedId);
    if (found) {
      applyWorkspace(found);
    }
    // sessions is in deps via applyWorkspace — re-runs when sessions load
  }, [workspaces, applyWorkspace, initialWorkspaceId, autoRestoreWorkspace]);

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
    // Notification ring: mark pane when agent needs attention
    sock.on("session-notify", () => {
      setAttentionPanes((prev) => {
        if (prev.has(paneId)) return prev;
        return new Set(prev).add(paneId);
      });
    });
    sock.on("interceptor-pending", () => {
      setAttentionPanes((prev) => {
        if (prev.has(paneId)) return prev;
        return new Set(prev).add(paneId);
      });
    });
    if (sock.connected) {
      setSocketStates((prev) => new Map(prev).set(paneId, true));
    }
  }, []);

  const destroySocket = useCallback((paneId: string) => {
    const sock = socketsRef.current.get(paneId);
    if (sock) {
      sock.removeAllListeners();
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

  const clearExitedPane = useCallback((paneIds: string[]) => {
    for (const id of paneIds) {
      exitedPanesRef.current.delete(id);
    }
  }, []);

  const handleClose = useCallback(
    (paneId: string) => {
      setTree((prev) => {
        let updated = prev;
        if (collectLeafIds(prev).length === 1) {
          updated = updateLeafSession(prev, paneId, null);
        } else {
          const result = closePane(prev, paneId);
          updated = result ?? prev;
        }
        return updated;
      });

      // Use functional updater to read latest activePaneId without stale closure
      setActivePaneId((prevActive) => {
        if (prevActive !== paneId) return prevActive;
        // Active pane was closed — pick another leaf
        // We need the updated tree; read from ref or re-derive
        return prevActive; // Will be corrected by the effect below
      });

      // Post-close: ensure activePaneId points to an existing leaf
      // Using setTimeout(0) to run after setTree has been applied
      setTimeout(() => {
        setTree((currentTree) => {
          const leaves = collectLeafIds(currentTree);
          setActivePaneId((prev) => {
            if (leaves.includes(prev)) return prev;
            return leaves[0] ?? prev;
          });
          return currentTree; // no mutation
        });
      }, 0);

      clearExitedPane([paneId]);
    },
    [clearExitedPane],
  );

  const handleSelectSession = useCallback(
    (paneId: string, sessionId: string) => {
      setTree((prev) => updateLeafSession(prev, paneId, sessionId));
      clearExitedPane([paneId]);
    },
    [clearExitedPane],
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

      clearExitedPane([paneId]);
    },
    [clearExitedPane],
  );

  const handlePaneExit = useCallback((paneId: string) => {
    exitedPanesRef.current.add(paneId);
  }, []);

  const handleRatioChange = useCallback(
    (splitId: string, index: number, delta: number) => {
      setTree((prev) => updateSplitRatio(prev, splitId, index, delta));
    },
    [],
  );

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

      clearExitedPane([sourcePaneId, targetPaneId]);
    },
    [clearExitedPane],
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

      clearExitedPane([sourcePaneId, targetPaneId]);
    },
    [clearExitedPane],
  );

  const handleKillSession = useCallback(
    async (paneId: string, sessionId: string) => {
      if (onKillSession) {
        await onKillSession(sessionId);
      } else {
        await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      }
      setTree((prev) => updateLeafSession(prev, paneId, null));
      clearExitedPane([paneId]);
    },
    [onKillSession, clearExitedPane],
  );

  const saveWorkspace = useCallback(async () => {
    setSavingWorkspace(true);
    try {
      const defaultName = `Workspace ${new Date().toLocaleString()}`;
      const name =
        workspaceName.trim() ||
        window.prompt("Workspace name:", defaultName)?.trim() ||
        defaultName;

      const isUpdate = !!selectedWorkspaceId;
      const method = isUpdate ? "PATCH" : "POST";
      const url = isUpdate
        ? `/api/workspaces/${selectedWorkspaceId}`
        : "/api/workspaces";

      const body = {
        name,
        tree: JSON.stringify(tree),
        activePaneId,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as ApiResponse<WorkspaceLayoutInfo>;
      if ("data" in json) {
        setSelectedWorkspaceId(json.data.id);
        setWorkspaceName(json.data.name);
        localStorage.setItem(WORKSPACE_STORAGE_KEY, json.data.id);
      }
      await fetchWorkspaces();
    } finally {
      setSavingWorkspace(false);
    }
  }, [workspaceName, selectedWorkspaceId, tree, activePaneId, fetchWorkspaces]);

  const deleteWorkspace = useCallback(async () => {
    if (!selectedWorkspaceId) return;
    await fetch(`/api/workspaces/${selectedWorkspaceId}`, {
      method: "DELETE",
    });
    setSelectedWorkspaceId("");
    setWorkspaceName("");
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    await fetchWorkspaces();
  }, [selectedWorkspaceId, fetchWorkspaces]);

  const leafCount = collectLeafIds(tree).length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1">
        <PaneRenderer
          node={tree}
          activePaneId={activePaneId}
          sockets={socketsRef.current}
          socketStates={socketStates}
          sessions={sessions}
          leafCount={leafCount}
          attentionPanes={attentionPanes}
          onActivate={(paneId) => {
            setActivePaneId(paneId);
            setAttentionPanes((prev) => {
              if (!prev.has(paneId)) return prev;
              const next = new Set(prev);
              next.delete(paneId);
              return next;
            });
          }}
          onSplit={handleSplit}
          onClose={handleClose}
          onSelectSession={handleSelectSession}
          onDropSession={handleDropSession}
          onSwapPanes={handleSwapPanes}
          onMovePane={handleMovePane}
          onRatioChange={handleRatioChange}
          onPaneExit={handlePaneExit}
          onKillSession={handleKillSession}
          workspace={{
            workspaces,
            selectedWorkspaceId,
            workspaceName,
            savingWorkspace,
            onSaveWorkspace: () => void saveWorkspace(),
            onApplyWorkspace: applyWorkspace,
            onDeleteWorkspace: () => void deleteWorkspace(),
            onSelectWorkspace: setSelectedWorkspaceId,
          }}
        />
      </div>
    </div>
  );
}
