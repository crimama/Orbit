"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SplitDivider from "@/components/terminal/SplitDivider";
import MultiTerminal from "@/components/terminal/MultiTerminal";
import FileEditor from "@/components/dashboard/FileEditor";
import PdfViewer from "@/components/dashboard/PdfViewer";
import type { ProjectInfo, SessionInfo } from "@/lib/types";

type ProjectPaneMode = "terminal" | "files" | "harness";
type SplitDirection = "horizontal" | "vertical";

type WorkspaceTab =
  | {
      id: string;
      kind: "session";
      title: string;
      projectId: string;
      projectName: string;
      projectColor: string;
      sessionId: string;
      status: SessionInfo["status"];
    }
  | {
      id: string;
      kind: "files" | "harness";
      title: string;
      projectId: string;
      projectName: string;
      projectColor: string;
    }
  | {
      id: string;
      kind: "file-view";
      title: string;
      projectId: string;
      projectName: string;
      projectColor: string;
      filePath: string;
      fileContent: string;
      fileMtimeMs: number;
    }
  | {
      id: string;
      kind: "pdf-view";
      title: string;
      projectId: string;
      projectName: string;
      projectColor: string;
      filePath: string;
    }
  | {
      id: string;
      kind: "browser";
      title: string;
      url: string;
    };

type WorkspacePanel = {
  id: string;
  activeTabId: string | null;
};

type WorkspaceLayoutNode =
  | {
      type: "leaf";
      panel: WorkspacePanel;
    }
  | {
      type: "split";
      id: string;
      direction: SplitDirection;
      ratio: number;
      first: WorkspaceLayoutNode;
      second: WorkspaceLayoutNode;
    };

export interface ViewedFile {
  projectId: string;
  path: string;
  viewer: "editor" | "pdf";
  content: string;
  mtimeMs: number;
  requestId: string;
}

interface BorderlessWorkspaceProps {
  sessions: SessionInfo[];
  selectedProject: ProjectInfo | null;
  projectPaneMode: ProjectPaneMode;
  inlineSessionId: string | null;
  inlineWorkspaceId: string | null;
  focusRequestId?: number;
  viewedFile?: ViewedFile | null;
  onCloseFile?: () => void;
  onKillSession: (sessionId: string) => Promise<void> | void;
  killedSessionId?: string | null;
  onEmpty?: () => void;
}

function buildSessionTab(
  session: SessionInfo,
): Extract<WorkspaceTab, { kind: "session" }> {
  return {
    id: `session:${session.id}`,
    kind: "session",
    title: session.name?.trim() || `Session ${session.id.slice(0, 8)}`,
    projectId: session.projectId,
    projectName: session.projectName,
    projectColor: session.projectColor,
    sessionId: session.id,
    status: session.status,
  };
}

function createLeaf(panel: WorkspacePanel): WorkspaceLayoutNode {
  return { type: "leaf", panel };
}

function collectPanels(node: WorkspaceLayoutNode): WorkspacePanel[] {
  if (node.type === "leaf") return [node.panel];
  return [...collectPanels(node.first), ...collectPanels(node.second)];
}

function findFirstPanelId(node: WorkspaceLayoutNode): string {
  if (node.type === "leaf") return node.panel.id;
  return findFirstPanelId(node.first);
}

function mapPanel(
  node: WorkspaceLayoutNode,
  panelId: string,
  updater: (panel: WorkspacePanel) => WorkspacePanel,
): WorkspaceLayoutNode {
  if (node.type === "leaf") {
    return node.panel.id === panelId
      ? { ...node, panel: updater(node.panel) }
      : node;
  }

  return {
    ...node,
    first: mapPanel(node.first, panelId, updater),
    second: mapPanel(node.second, panelId, updater),
  };
}

function removePanel(
  node: WorkspaceLayoutNode,
  panelId: string,
): { node: WorkspaceLayoutNode; removed: boolean; focusPanelId: string } {
  if (node.type === "leaf") {
    return {
      node,
      removed: false,
      focusPanelId: node.panel.id,
    };
  }

  if (node.first.type === "leaf" && node.first.panel.id === panelId) {
    return {
      node: node.second,
      removed: true,
      focusPanelId: findFirstPanelId(node.second),
    };
  }

  if (node.second.type === "leaf" && node.second.panel.id === panelId) {
    return {
      node: node.first,
      removed: true,
      focusPanelId: findFirstPanelId(node.first),
    };
  }

  const firstResult = removePanel(node.first, panelId);
  if (firstResult.removed) {
    return {
      node: { ...node, first: firstResult.node },
      removed: true,
      focusPanelId: firstResult.focusPanelId,
    };
  }

  const secondResult = removePanel(node.second, panelId);
  if (secondResult.removed) {
    return {
      node: { ...node, second: secondResult.node },
      removed: true,
      focusPanelId: secondResult.focusPanelId,
    };
  }

  return {
    node,
    removed: false,
    focusPanelId: findFirstPanelId(node),
  };
}

function splitPanel(
  node: WorkspaceLayoutNode,
  panelId: string,
  newPanel: WorkspacePanel,
  splitId: string,
  direction: SplitDirection,
): WorkspaceLayoutNode {
  if (node.type === "leaf") {
    if (node.panel.id !== panelId) return node;
    return {
      type: "split",
      id: splitId,
      direction,
      ratio: 0.5,
      first: node,
      second: createLeaf(newPanel),
    };
  }

  return {
    ...node,
    first: splitPanel(node.first, panelId, newPanel, splitId, direction),
    second: splitPanel(node.second, panelId, newPanel, splitId, direction),
  };
}

function mapSplit(
  node: WorkspaceLayoutNode,
  splitId: string,
  updater: (
    node: Extract<WorkspaceLayoutNode, { type: "split" }>,
  ) => Extract<WorkspaceLayoutNode, { type: "split" }>,
): WorkspaceLayoutNode {
  if (node.type === "leaf") return node;
  const next = node.id === splitId ? updater(node) : node;
  return {
    ...next,
    first: mapSplit(next.first, splitId, updater),
    second: mapSplit(next.second, splitId, updater),
  };
}

function buildPanelLabel(panelIndex: number, panelCount: number) {
  if (panelCount === 1) return "Workspace";
  return `Panel ${panelIndex + 1}`;
}

function findFallbackTabId(tabs: WorkspaceTab[], tabId: string) {
  return tabs.find((tab) => tab.id !== tabId)?.id ?? null;
}

function tabKindLabel(tab: WorkspaceTab) {
  if (tab.kind === "session") return "Session";
  if (tab.kind === "file-view") return "File";
  if (tab.kind === "pdf-view") return "PDF";
  if (tab.kind === "files") return "Files";
  if (tab.kind === "harness") return "Harness";
  return "Browser";
}

function tabKindMark(tab: WorkspaceTab) {
  if (tab.kind === "session") return "$";
  if (tab.kind === "file-view") return "F";
  if (tab.kind === "pdf-view") return "PDF";
  if (tab.kind === "files") return "DIR";
  if (tab.kind === "harness") return "H";
  return "WEB";
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return `rgba(56, 189, 248, ${alpha})`;
  }

  const numeric = Number.parseInt(value, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default function BorderlessWorkspace({
  sessions,
  selectedProject,
  projectPaneMode,
  inlineSessionId,
  inlineWorkspaceId,
  focusRequestId = 0,
  viewedFile,
  onCloseFile,
  onKillSession,
  killedSessionId,
  onEmpty,
}: BorderlessWorkspaceProps) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [layout, setLayout] = useState<WorkspaceLayoutNode>(
    createLeaf({ id: "panel-1", activeTabId: null }),
  );
  const [activePanelId, setActivePanelId] = useState("panel-1");
  const [mountedBrowserTabs, setMountedBrowserTabs] = useState<
    Record<string, string[]>
  >({});

  const tabsById = useMemo(
    () => new Map(tabs.map((tab) => [tab.id, tab])),
    [tabs],
  );
  const panels = useMemo(() => collectPanels(layout), [layout]);
  const activePanel = useMemo(
    () => panels.find((panel) => panel.id === activePanelId) ?? panels[0],
    [activePanelId, panels],
  );

  const panelIdCounterRef = useRef(1);
  const splitIdCounterRef = useRef(0);
  const lastInlineSessionIdRef = useRef<string | null>(null);
  const lastFocusRequestIdRef = useRef(0);
  const lastProjectPaneKeyRef = useRef<string>("");
  const lastViewedFileRef = useRef<string | null>(null);
  const prevTabCountRef = useRef(tabs.length);

  const setPanelActiveTab = useCallback((panelId: string, tabId: string) => {
    setLayout((prev) =>
      mapPanel(prev, panelId, (panel) => ({ ...panel, activeTabId: tabId })),
    );
    setActivePanelId(panelId);
  }, []);

  const upsertTab = useCallback(
    (nextTab: WorkspaceTab, targetPanelId?: string) => {
      const panelId = targetPanelId ?? activePanelId;

      setTabs((prev) => {
        const found = prev.find((tab) => tab.id === nextTab.id);
        if (found) {
          return prev.map((tab) => (tab.id === nextTab.id ? nextTab : tab));
        }
        return [...prev, nextTab];
      });

      setLayout((prev) =>
        mapPanel(prev, panelId, (panel) => ({
          ...panel,
          activeTabId: nextTab.id,
        })),
      );
      setActivePanelId(panelId);
    },
    [activePanelId],
  );

  const splitPanelWithTab = useCallback(
    (targetPanelId: string, tabId: string, direction: SplitDirection) => {
      panelIdCounterRef.current += 1;
      splitIdCounterRef.current += 1;
      const panelId = `panel-${panelIdCounterRef.current}`;
      const splitId = `split-${splitIdCounterRef.current}`;
      const newPanel = { id: panelId, activeTabId: tabId };

      setLayout((prev) =>
        splitPanel(prev, targetPanelId, newPanel, splitId, direction),
      );
      setActivePanelId(panelId);
    },
    [],
  );

  const findSessionPanelId = useCallback(
    (sessionId: string | null) => {
      if (sessionId) {
        const tabId = `session:${sessionId}`;
        const panel = panels.find((item) => item.activeTabId === tabId);
        if (panel) return panel.id;
      }

      return activePanel?.id ?? panels[0]?.id ?? "panel-1";
    },
    [activePanel?.id, panels],
  );

  useEffect(() => {
    if (!inlineSessionId) return;
    if (
      inlineSessionId === lastInlineSessionIdRef.current &&
      focusRequestId === lastFocusRequestIdRef.current
    ) {
      return;
    }
    const previousInlineSessionId = lastInlineSessionIdRef.current;
    lastInlineSessionIdRef.current = inlineSessionId;
    lastFocusRequestIdRef.current = focusRequestId;

    const session = sessions.find((item) => item.id === inlineSessionId);
    const tab: WorkspaceTab = session
      ? buildSessionTab(session)
      : {
          id: `session:${inlineSessionId}`,
          kind: "session" as const,
          title: `Session ${inlineSessionId.slice(0, 8)}`,
          projectId: selectedProject?.id ?? "",
          projectName: selectedProject?.name ?? "",
          projectColor: selectedProject?.color ?? "#64748b",
          sessionId: inlineSessionId,
          status: "active",
        };

    upsertTab(tab, findSessionPanelId(previousInlineSessionId));
  }, [
    findSessionPanelId,
    focusRequestId,
    inlineSessionId,
    selectedProject,
    sessions,
    upsertTab,
  ]);

  useEffect(() => {
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        if (tab.kind !== "session") return tab;
        const fresh = sessions.find((s) => s.id === tab.sessionId);
        if (!fresh) return tab;
        const updated = buildSessionTab(fresh);
        if (
          updated.title === tab.title &&
          updated.projectName === tab.projectName &&
          updated.status === tab.status
        ) {
          return tab;
        }
        changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, [sessions]);

  useEffect(() => {
    const paneKey = `${selectedProject?.id ?? "none"}:${projectPaneMode}:${inlineSessionId ?? "none"}`;
    if (paneKey === lastProjectPaneKeyRef.current) return;
    lastProjectPaneKeyRef.current = paneKey;

    if (!selectedProject) return;

    if (projectPaneMode === "harness") return;

    const projectActiveSession = sessions.find(
      (session) =>
        session.projectId === selectedProject.id &&
        session.status === "active" &&
        session.id === inlineSessionId,
    );

    if (projectActiveSession) {
      upsertTab(
        buildSessionTab(projectActiveSession),
        findSessionPanelId(projectActiveSession.id),
      );
    }
  }, [
    findSessionPanelId,
    inlineSessionId,
    projectPaneMode,
    selectedProject,
    sessions,
    upsertTab,
  ]);

  useEffect(() => {
    if (!killedSessionId) return;
    const tabId = `session:${killedSessionId}`;
    setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
  }, [killedSessionId]);

  useEffect(() => {
    const wasNonEmpty = prevTabCountRef.current > 0;
    prevTabCountRef.current = tabs.length;

    if (tabs.length === 0) {
      setLayout((prev) =>
        panels.length === 1 && panels[0]?.activeTabId === null
          ? prev
          : createLeaf({ id: panels[0]?.id ?? "panel-1", activeTabId: null }),
      );
      if (wasNonEmpty) onEmpty?.();
      return;
    }

    setLayout((prev) => {
      let changed = false;
      const updateMissingTabs = (node: WorkspaceLayoutNode): WorkspaceLayoutNode => {
        if (node.type === "leaf") {
          if (node.panel.activeTabId && tabsById.has(node.panel.activeTabId)) {
            return node;
          }
          changed = true;
          return {
            ...node,
            panel: { ...node.panel, activeTabId: tabs[0].id },
          };
        }
        return {
          ...node,
          first: updateMissingTabs(node.first),
          second: updateMissingTabs(node.second),
        };
      };
      const next = updateMissingTabs(prev);
      return changed ? next : prev;
    });
  }, [onEmpty, panels, tabs, tabsById]);

  useEffect(() => {
    setMountedBrowserTabs((prev) => {
      const browserIds = new Set(
        tabs
          .filter(
            (tab): tab is Extract<WorkspaceTab, { kind: "browser" }> =>
              tab.kind === "browser",
          )
          .map((tab) => tab.id),
      );
      const panelIds = new Set(panels.map((panel) => panel.id));
      let changed = false;
      const next: Record<string, string[]> = {};

      for (const panel of panels) {
        const tabIds = (prev[panel.id] ?? []).filter((id) =>
          browserIds.has(id),
        );
        next[panel.id] = tabIds;
        if (tabIds.length !== (prev[panel.id] ?? []).length) changed = true;
      }

      for (const key of Object.keys(prev)) {
        if (!panelIds.has(key)) changed = true;
      }

      return changed ? next : prev;
    });
  }, [panels, tabs]);

  useEffect(() => {
    const activeTabId = activePanel.activeTabId;
    if (!activeTabId) return;
    const tab = tabsById.get(activeTabId);
    if (tab?.kind !== "browser") return;

    setMountedBrowserTabs((prev) => {
      const current = prev[activePanel.id] ?? [];
      if (current.includes(activeTabId)) return prev;
      return { ...prev, [activePanel.id]: [...current, activeTabId] };
    });
  }, [activePanel.activeTabId, activePanel.id, tabsById]);

  const forgetClosedBrowserTab = useCallback((tabId: string) => {
    setMountedBrowserTabs((prev) => {
      let changed = false;
      const next: Record<string, string[]> = {};
      for (const [panelId, tabIds] of Object.entries(prev)) {
        const filtered = tabIds.filter((id) => id !== tabId);
        next[panelId] = filtered;
        if (filtered.length !== tabIds.length) changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      const closedTab = tabsById.get(tabId);
      if (closedTab?.kind === "file-view") {
        onCloseFile?.();
      }
      if (closedTab?.kind === "browser") {
        forgetClosedBrowserTab(tabId);
      }
      setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    },
    [forgetClosedBrowserTab, onCloseFile, tabsById],
  );

  const removeTab = useCallback(
    (tabId: string) => {
      forgetClosedBrowserTab(tabId);
      setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    },
    [forgetClosedBrowserTab],
  );

  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [splitHover, setSplitHover] = useState<string | null>(null);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const dragSourcePanelIdRef = useRef<string | null>(null);

  const moveTabFromSource = useCallback(
    (tabId: string, targetPanelId: string) => {
      const sourcePanelId = dragSourcePanelIdRef.current;
      if (!sourcePanelId || sourcePanelId === targetPanelId) return;

      const fallbackTabId = findFallbackTabId(tabs, tabId);
      setLayout((prev) =>
        mapPanel(prev, sourcePanelId, (panel) =>
          panel.activeTabId === tabId
            ? { ...panel, activeTabId: fallbackTabId }
            : panel,
        ),
      );
    },
    [tabs],
  );

  const clearTabFromDragSource = useCallback(
    (tabId: string) => {
      const sourcePanelId = dragSourcePanelIdRef.current;
      if (!sourcePanelId) return;

      const fallbackTabId = findFallbackTabId(tabs, tabId);
      setLayout((prev) =>
        mapPanel(prev, sourcePanelId, (panel) =>
          panel.activeTabId === tabId
            ? { ...panel, activeTabId: fallbackTabId }
            : panel,
        ),
      );
    },
    [tabs],
  );

  const handleTabDragStart = (
    panelId: string,
    tabId: string,
    e: React.DragEvent,
  ) => {
    e.dataTransfer.setData("text/x-orbit-tab-id", tabId);
    e.dataTransfer.effectAllowed = "move";
    dragSourcePanelIdRef.current = panelId;
    setIsDraggingTab(true);
  };

  const handleTabDragEnd = () => {
    setIsDraggingTab(false);
    setDropTarget(null);
    setSplitHover(null);
    dragSourcePanelIdRef.current = null;
  };

  const handleTabDrop = (
    panelId: string,
    event: React.DragEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    setDropTarget(null);
    setSplitHover(null);
    setIsDraggingTab(false);
    const tabId = event.dataTransfer.getData("text/x-orbit-tab-id");
    if (!tabId) return;
    moveTabFromSource(tabId, panelId);
    setPanelActiveTab(panelId, tabId);
    dragSourcePanelIdRef.current = null;
  };

  const handleSplitDrop = (
    panelId: string,
    direction: SplitDirection,
    event: React.DragEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    setSplitHover(null);
    setIsDraggingTab(false);
    const tabId = event.dataTransfer.getData("text/x-orbit-tab-id");
    if (!tabId) return;
    clearTabFromDragSource(tabId);
    splitPanelWithTab(panelId, tabId, direction);
    dragSourcePanelIdRef.current = null;
  };

  const handlePanelDragOver = (
    panelId: string,
    event: React.DragEvent<HTMLElement>,
  ) => {
    if (event.dataTransfer.types.includes("text/x-orbit-tab-id")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(panelId);
    }
  };

  const handlePanelDragLeave = () => {
    setDropTarget(null);
  };

  useEffect(() => {
    if (!viewedFile) {
      lastViewedFileRef.current = null;
      return;
    }

    if (!selectedProject) return;
    const key = viewedFile.requestId;
    if (key === lastViewedFileRef.current) return;
    lastViewedFileRef.current = key;

    const title = viewedFile.path.split("/").pop() ?? viewedFile.path;
    const fileTab: WorkspaceTab =
      viewedFile.viewer === "pdf"
        ? {
            id: `pdf-view:${viewedFile.projectId}:${viewedFile.path}`,
            kind: "pdf-view",
            title,
            projectId: viewedFile.projectId,
            projectName: selectedProject.name,
            projectColor: selectedProject.color,
            filePath: viewedFile.path,
          }
        : {
            id: `file-view:${viewedFile.projectId}:${viewedFile.path}`,
            kind: "file-view",
            title,
            projectId: viewedFile.projectId,
            projectName: selectedProject.name,
            projectColor: selectedProject.color,
            filePath: viewedFile.path,
            fileContent: viewedFile.content,
            fileMtimeMs: viewedFile.mtimeMs,
          };

    upsertTab(fileTab, activePanel.id);
  }, [activePanel.id, selectedProject, upsertTab, viewedFile]);

  const renderNonSessionTab = (tab: WorkspaceTab | null) => {
    if (!tab) return null;
    if (tab.kind === "file-view") {
      return (
        <FileEditor
          key={tab.id}
          projectId={tab.projectId}
          filePath={tab.filePath}
          initialContent={tab.fileContent}
          initialMtimeMs={tab.fileMtimeMs}
          onClose={onCloseFile}
        />
      );
    }
    if (tab.kind === "pdf-view") {
      return (
        <PdfViewer
          key={tab.id}
          projectId={tab.projectId}
          filePath={tab.filePath}
        />
      );
    }
    if (tab.kind === "browser") {
      return (
        <div
          key={tab.id}
          className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
        >
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/80 px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              Browser
            </span>
            <span className="truncate text-xs text-neutral-400">{tab.url}</span>
          </div>
          <iframe
            src={tab.url}
            className="min-h-0 flex-1 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={tab.title}
          />
        </div>
      );
    }
    return null;
  };

  const renderPanelContent = (panel: WorkspacePanel) => {
    const browserTabs = (mountedBrowserTabs[panel.id] ?? [])
      .map((tabId) => tabsById.get(tabId))
      .filter(
        (tab): tab is Extract<WorkspaceTab, { kind: "browser" }> =>
          tab?.kind === "browser",
      );
    const activeTab = panel.activeTabId
      ? (tabsById.get(panel.activeTabId) ?? null)
      : null;
    const isActiveSession = activeTab?.kind === "session";
    const isActiveBrowser = activeTab?.kind === "browser";

    return (
      <>
        {isActiveSession && activeTab ? (
          <div
            key={activeTab.id}
            className="absolute inset-0"
          >
            <MultiTerminal
              key={`${panel.id}:${activeTab.id}`}
              initialSessionId={activeTab.sessionId}
              initialWorkspaceId={
                panel.activeTabId === activeTab.id ? inlineWorkspaceId : undefined
              }
              autoRestoreWorkspace={false}
              onKillSession={onKillSession}
              onPaneSessionsChange={(sessionIds) => {
                setTabs((prev) =>
                  prev.map((item) => {
                    if (item.id !== activeTab.id || item.kind !== "session") {
                      return item;
                    }
                    const names = sessionIds
                      .map((id) => sessions.find((s) => s.id === id))
                      .filter(Boolean)
                      .map((s) => s!.name ?? s!.agentType);
                    const title =
                      names.length === 0
                        ? "Empty"
                        : names.length === 1
                          ? names[0]
                          : `Workspace (${names.length})`;
                    if (item.title === title) return item;
                    return { ...item, title };
                  }),
                );
              }}
              onAllPanesEmpty={() => removeTab(activeTab.id)}
            />
          </div>
        ) : null}
        {browserTabs.map((tab) => (
          <div
            key={`${panel.id}:${tab.id}`}
            className="absolute inset-0"
            style={{
              visibility: panel.activeTabId === tab.id ? "visible" : "hidden",
              zIndex: panel.activeTabId === tab.id ? 1 : 0,
            }}
          >
            {renderNonSessionTab(tab)}
          </div>
        ))}
        {!isActiveSession && !isActiveBrowser && activeTab
          ? renderNonSessionTab(activeTab)
          : null}
      </>
    );
  };

  const handleClosePanel = (panelId: string) => {
    if (panels.length <= 1) return;

    const result = removePanel(layout, panelId);
    if (!result.removed) return;
    setLayout(result.node);
    setActivePanelId(result.focusPanelId);
  };

  const handleResize = (splitId: string, delta: number) => {
    setLayout((prev) =>
      mapSplit(prev, splitId, (node) => ({
        ...node,
        ratio: Math.max(0.1, Math.min(0.9, node.ratio + delta)),
      })),
    );
  };

  const renderTabBar = (panel: WorkspacePanel, panelIndex: number) => (
    <div className="flex min-h-8 items-center gap-2 bg-neutral-900 px-2 py-1 text-xs">
      <span className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-[12px] font-medium text-neutral-200">
        {buildPanelLabel(panelIndex, panels.length)}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {tabs.length === 0 ? (
          <span className="text-[11px] text-neutral-500">No workspace</span>
        ) : (
          tabs.map((tab) => {
            const isActive = panel.activeTabId === tab.id;
            const projectColor =
              "projectColor" in tab ? tab.projectColor : "#38bdf8";
            const backgroundColor = hexToRgba(
              projectColor,
              isActive ? 0.28 : 0.13,
            );

            return (
              <span
                key={`${panel.id}-ws-${tab.id}`}
                className={`group/tab flex shrink-0 items-stretch overflow-hidden rounded border text-[12px] leading-5 ${
                  isActive
                    ? "border-neutral-600 text-neutral-100 shadow-sm shadow-black/20"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                }`}
                style={{
                  backgroundColor,
                }}
                title={`${tabKindLabel(tab)}: ${tab.title}`}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={(event) =>
                    handleTabDragStart(panel.id, tab.id, event)
                  }
                  onDragEnd={handleTabDragEnd}
                  onClick={() => setPanelActiveTab(panel.id, tab.id)}
                  className="flex cursor-grab items-center gap-1.5 py-1.5 pl-2 pr-1 active:cursor-grabbing"
                >
                  <span
                    className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-neutral-700 bg-neutral-950/50 px-1 font-mono text-[10px] font-semibold text-neutral-300"
                    aria-hidden="true"
                  >
                    {tabKindMark(tab)}
                  </span>
                  {"projectName" in tab && (
                    <span className="font-semibold text-neutral-200">
                      {tab.projectName}
                    </span>
                  )}
                  {tab.kind === "session" && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        tab.status === "active"
                          ? "bg-emerald-400"
                          : "bg-neutral-500"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`${"projectName" in tab ? "ml-0.5 " : ""}max-w-[13rem] truncate text-neutral-300`}
                  >
                    {tab.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="px-1.5 py-1 text-neutral-500 opacity-0 hover:bg-neutral-700 hover:text-neutral-100 group-hover/tab:opacity-100"
                  title="Close tab"
                >
                  ×
                </button>
              </span>
            );
          })
        )}
      </div>
      {panels.length > 1 && (
        <button
          type="button"
          onClick={() => handleClosePanel(panel.id)}
          className="shrink-0 rounded px-2 py-1 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
          title="Close this panel"
        >
          ×
        </button>
      )}
    </div>
  );

  const renderSplitDropZones = (panel: WorkspacePanel) => {
    if (!isDraggingTab) return null;

    const rightKey = `${panel.id}:right`;
    const bottomKey = `${panel.id}:bottom`;

    return (
      <>
        <section
          className={`absolute bottom-0 right-0 top-0 z-20 flex w-1/3 items-center justify-center border-l-2 border-dashed transition-colors ${
            splitHover === rightKey
              ? "border-fuchsia-400/70 bg-fuchsia-400/15"
              : "border-neutral-700/60 bg-neutral-950/35"
          }`}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("text/x-orbit-tab-id")) {
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "move";
              setSplitHover(rightKey);
            }
          }}
          onDragLeave={() => setSplitHover(null)}
          onDrop={(event) => handleSplitDrop(panel.id, "horizontal", event)}
        >
          <span
            className={`text-xs ${splitHover === rightKey ? "text-fuchsia-200" : "text-neutral-500"}`}
          >
            Right
          </span>
        </section>
        <section
          className={`absolute bottom-0 left-0 right-0 z-30 flex h-1/3 items-center justify-center border-t-2 border-dashed transition-colors ${
            splitHover === bottomKey
              ? "border-amber-400/70 bg-amber-400/15"
              : "border-neutral-700/60 bg-neutral-950/35"
          }`}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("text/x-orbit-tab-id")) {
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "move";
              setSplitHover(bottomKey);
            }
          }}
          onDragLeave={() => setSplitHover(null)}
          onDrop={(event) => handleSplitDrop(panel.id, "vertical", event)}
        >
          <span
            className={`text-xs ${splitHover === bottomKey ? "text-amber-200" : "text-neutral-500"}`}
          >
            Bottom
          </span>
        </section>
      </>
    );
  };

  const renderPanel = (panel: WorkspacePanel) => {
    const panelIndex = panels.findIndex((item) => item.id === panel.id);

    return (
      <section
        key={panel.id}
        className={`relative h-full w-full min-h-0 min-w-0 overflow-hidden border ${
          activePanelId === panel.id
            ? "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.55)]"
            : "border-transparent"
        }`}
        onMouseDown={() => setActivePanelId(panel.id)}
        onDragOver={(event) => handlePanelDragOver(panel.id, event)}
        onDragLeave={handlePanelDragLeave}
        onDrop={(event) => handleTabDrop(panel.id, event)}
      >
        <div className="flex h-full w-full min-h-0 min-w-0 flex-col">
          {renderTabBar(panel, panelIndex)}
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            {renderPanelContent(panel)}
            {dropTarget === panel.id && !splitHover && (
              <div className="pointer-events-none absolute inset-0 z-10 rounded bg-cyan-400/10 ring-2 ring-inset ring-cyan-400/40" />
            )}
            {renderSplitDropZones(panel)}
          </div>
        </div>
      </section>
    );
  };

  const renderLayoutNode = (node: WorkspaceLayoutNode): React.ReactNode => {
    if (node.type === "leaf") return renderPanel(node.panel);

    const isHorizontal = node.direction === "horizontal";
    return (
      <div
        key={node.id}
        className={`flex h-full min-h-0 min-w-0 overflow-hidden ${
          isHorizontal ? "flex-row" : "flex-col"
        }`}
      >
        <div
          className="h-full w-full min-h-0 min-w-0 overflow-hidden"
          style={{ flex: `${node.ratio} 1 0` }}
        >
          {renderLayoutNode(node.first)}
        </div>
        <SplitDivider
          direction={node.direction}
          onDeltaChange={(delta) => handleResize(node.id, delta)}
          onReset={() => {
            setLayout((prev) =>
              mapSplit(prev, node.id, (splitNode) => ({
                ...splitNode,
                ratio: 0.5,
              })),
            );
          }}
        />
        <div
          className="h-full w-full min-h-0 min-w-0 overflow-hidden"
          style={{ flex: `${1 - node.ratio} 1 0` }}
        >
          {renderLayoutNode(node.second)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-950">
      <div className="min-h-0 flex-1 overflow-hidden">
        {renderLayoutNode(layout)}
      </div>
    </div>
  );
}
