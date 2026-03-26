"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SplitDivider from "@/components/terminal/SplitDivider";
import MultiTerminal from "@/components/terminal/MultiTerminal";
import ProjectHarnessPanel from "@/components/dashboard/ProjectHarnessPanel";
import FileEditor from "@/components/dashboard/FileEditor";
import type { ProjectInfo, SessionInfo } from "@/lib/types";

type ProjectPaneMode = "terminal" | "files" | "harness";
type PanelSide = "left" | "right";
type WorkspaceLayoutMode = "split" | "left" | "right";
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
    }
  | {
      id: string;
      kind: "browser";
      title: string;
      url: string;
    };

export interface ViewedFile {
  projectId: string;
  path: string;
  content: string;
}

interface BorderlessWorkspaceProps {
  sessions: SessionInfo[];
  selectedProject: ProjectInfo | null;
  projectPaneMode: ProjectPaneMode;
  inlineSessionId: string | null;
  inlineWorkspaceId: string | null;
  viewedFile?: ViewedFile | null;
  onCloseFile?: () => void;
  onKillSession: (sessionId: string) => Promise<void> | void;
  killedSessionId?: string | null;
  onEmpty?: () => void;
}

function buildSessionTab(session: SessionInfo): WorkspaceTab {
  return {
    id: `session:${session.id}`,
    kind: "session",
    title: session.name?.trim() || `Session ${session.id.slice(0, 8)}`,
    projectId: session.projectId,
    projectName: session.projectName,
    projectColor: session.projectColor,
    sessionId: session.id,
  };
}

function buildProjectTab(
  project: ProjectInfo,
  kind: "files" | "harness",
): WorkspaceTab {
  return {
    id: `${kind}:${project.id}`,
    kind,
    title: kind === "files" ? "Files" : "Harness",
    projectId: project.id,
    projectName: project.name,
    projectColor: project.color,
  };
}

export default function BorderlessWorkspace({
  sessions,
  selectedProject,
  projectPaneMode,
  inlineSessionId,
  inlineWorkspaceId,
  viewedFile,
  onCloseFile,
  onKillSession,
  killedSessionId,
  onEmpty,
}: BorderlessWorkspaceProps) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activePanel, setActivePanel] = useState<PanelSide>("left");
  const [leftTabId, setLeftTabId] = useState<string | null>(null);
  const [rightTabId, setRightTabId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>("left");
  const [splitDirection] = useState<SplitDirection>("horizontal");

  const tabsById = useMemo(
    () => new Map(tabs.map((tab) => [tab.id, tab])),
    [tabs],
  );
  const lastInlineSessionIdRef = useRef<string | null>(null);
  const lastProjectPaneKeyRef = useRef<string>("");

  const upsertTab = useCallback(
    (nextTab: WorkspaceTab, targetPanel: PanelSide) => {
      setTabs((prev) => {
        const found = prev.find((tab) => tab.id === nextTab.id);
        if (found) {
          return prev.map((tab) => (tab.id === nextTab.id ? nextTab : tab));
        }
        return [...prev, nextTab];
      });

      if (targetPanel === "left") {
        setLeftTabId(nextTab.id);
      } else {
        setRightTabId(nextTab.id);
      }
      setActivePanel(targetPanel);
    },
    [],
  );

  useEffect(() => {
    if (!inlineSessionId) return;
    if (inlineSessionId === lastInlineSessionIdRef.current) return;
    lastInlineSessionIdRef.current = inlineSessionId;

    const session = sessions.find((item) => item.id === inlineSessionId);

    // Build tab from session data if available, or create a minimal stub
    // so the tab appears immediately even before fetchSessions() resolves.
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
        };

    if (layoutMode === "split") {
      upsertTab(tab, activePanel);
    } else {
      upsertTab(tab, "left");
      setLayoutMode("left");
      setActivePanel("left");
    }
  }, [inlineSessionId, sessions, selectedProject, upsertTab, layoutMode, activePanel]);

  // Update tab metadata when sessions list refreshes (replaces stub with real data)
  useEffect(() => {
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        if (tab.kind !== "session") return tab;
        const st = tab as Extract<WorkspaceTab, { kind: "session" }>;
        const fresh = sessions.find((s) => s.id === st.sessionId);
        if (!fresh) return tab;
        const updated = buildSessionTab(fresh);
        if (updated.title === st.title && (updated as typeof st).projectName === st.projectName) return tab;
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

    if (projectPaneMode === "harness") {
      upsertTab(buildProjectTab(selectedProject, "harness"), activePanel);
      return;
    }

    const projectActiveSession = sessions.find(
      (session) =>
        session.projectId === selectedProject.id &&
        session.status === "active" &&
        session.id === inlineSessionId,
    );

    if (projectActiveSession) {
      if (layoutMode === "split") {
        upsertTab(buildSessionTab(projectActiveSession), activePanel);
      } else {
        upsertTab(buildSessionTab(projectActiveSession), "left");
        setLayoutMode("left");
        setActivePanel("left");
      }
    }
  }, [
    selectedProject,
    projectPaneMode,
    sessions,
    inlineSessionId,
    activePanel,
    layoutMode,
    upsertTab,
  ]);

  // Remove tab when its session is killed from sidebar
  const lastKilledRef = useRef(killedSessionId);
  useEffect(() => {
    if (!killedSessionId || killedSessionId === lastKilledRef.current) return;
    lastKilledRef.current = killedSessionId;
    const tabId = `session:${killedSessionId}`;
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  }, [killedSessionId]);

  const prevTabCountRef = useRef(tabs.length);
  useEffect(() => {
    const wasNonEmpty = prevTabCountRef.current > 0;
    prevTabCountRef.current = tabs.length;

    if (tabs.length === 0) {
      if (leftTabId !== null) setLeftTabId(null);
      if (rightTabId !== null) setRightTabId(null);
      if (wasNonEmpty) onEmpty?.();
      return;
    }

    if (!leftTabId || !tabsById.has(leftTabId)) {
      setLeftTabId(tabs[0].id);
    }
    if (!rightTabId || !tabsById.has(rightTabId)) {
      const fallback = tabs[1]?.id ?? tabs[0].id;
      setRightTabId(fallback);
    }
  }, [tabs, tabsById, leftTabId, rightTabId]);

  const assignTabToPanel = (tabId: string, panel: PanelSide) => {
    if (panel === "left") {
      setLeftTabId(tabId);
    } else {
      setRightTabId(tabId);
    }
    setActivePanel(panel);
  };

  const closeTab = useCallback(
    (tabId: string) => {
      const closedTab = tabsById.get(tabId);
      if (closedTab?.kind === "file-view") {
        onCloseFile?.();
      }
      setTabs((prev) => prev.filter((t) => t.id !== tabId));
    },
    [tabsById, onCloseFile],
  );

  const [dropTarget, setDropTarget] = useState<PanelSide | null>(null);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  // Which drop zone is hovered: "right" = vertical split, "bottom" = horizontal split
  const [dropZoneHover, setDropZoneHover] = useState<"right" | "bottom" | null>(null);

  const handleTabDragStart = (tabId: string, e: React.DragEvent) => {
    e.dataTransfer.setData("text/x-orbit-tab-id", tabId);
    e.dataTransfer.effectAllowed = "move";
    setIsDraggingTab(true);
  };

  const handleTabDragEnd = () => {
    setIsDraggingTab(false);
    setDropTarget(null);
    setDropZoneHover(null);
  };

  const handleTabDrop = (
    panel: PanelSide,
    event: React.DragEvent<HTMLElement>,
    _direction?: SplitDirection, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    event.preventDefault();
    setDropTarget(null);
    setIsDraggingTab(false);
    setDropZoneHover(null);
    const tabId = event.dataTransfer.getData("text/x-orbit-tab-id");
    if (!tabId) return;
    assignTabToPanel(tabId, panel);
    if (panel === "right") {
      setLayoutMode("split");
    }
  };

  const handlePanelDragOver = (
    panel: PanelSide,
    event: React.DragEvent<HTMLElement>,
  ) => {
    if (event.dataTransfer.types.includes("text/x-orbit-tab-id")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(panel);
    }
  };

  const handlePanelDragLeave = () => {
    setDropTarget(null);
  };


  // Open file tab when viewedFile changes
  const lastViewedFileRef = useRef<string | null>(null);
  useEffect(() => {
    if (!viewedFile || !selectedProject) return;
    const key = `${viewedFile.projectId}:${viewedFile.path}`;
    if (key === lastViewedFileRef.current) return;
    lastViewedFileRef.current = key;

    const fileTab: WorkspaceTab = {
      id: `file-view:${viewedFile.projectId}:${viewedFile.path}`,
      kind: "file-view",
      title: viewedFile.path.split("/").pop() ?? viewedFile.path,
      projectId: viewedFile.projectId,
      projectName: selectedProject.name,
      projectColor: selectedProject.color,
      filePath: viewedFile.path,
      fileContent: viewedFile.content,
    };

    if (layoutMode === "split") {
      upsertTab(fileTab, activePanel);
    } else {
      upsertTab(fileTab, "left");
      setLayoutMode("left");
    }
  }, [viewedFile, selectedProject, leftTabId, tabsById, upsertTab]);

  const removeTab = useCallback((tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  }, []);

  const renderNonSessionTab = (tab: WorkspaceTab | null) => {
    if (!tab) return null;
    if (tab.kind === "file-view") {
      return (
        <FileEditor
          key={tab.id}
          projectId={tab.projectId}
          filePath={tab.filePath}
          initialContent={tab.fileContent}
          onClose={onCloseFile}
        />
      );
    }
    if (tab.kind === "browser") {
      return (
        <div key={tab.id} className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/80 px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Browser</span>
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
    if (tab.kind === "harness") {
      return <ProjectHarnessPanel key={tab.id} projectId={tab.projectId} />;
    }
    return null;
  };

  /** Render all session tabs (always mounted, visibility toggled) + active non-session tab */
  const renderPanelContent = (activeTabId: string | null) => {
    const sessionTabs = tabs.filter(
      (t): t is Extract<WorkspaceTab, { kind: "session" }> => t.kind === "session",
    );
    const activeTab = activeTabId ? tabsById.get(activeTabId) ?? null : null;
    const isActiveSession = activeTab?.kind === "session";

    return (
      <>
        {/* Session tabs: always mounted, toggle visibility */}
        {sessionTabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{
              visibility: activeTabId === tab.id ? "visible" : "hidden",
              zIndex: activeTabId === tab.id ? 1 : 0,
            }}
          >
            <MultiTerminal
              key={tab.id}
              initialSessionId={tab.sessionId}
              initialWorkspaceId={activeTabId === tab.id ? inlineWorkspaceId : undefined}
              autoRestoreWorkspace={false}
              onKillSession={onKillSession}
              onPaneSessionsChange={(sessionIds) => {
                setTabs((prev) =>
                  prev.map((t) => {
                    if (t.id !== tab.id || t.kind !== "session") return t;
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
                    if (t.title === title) return t;
                    return { ...t, title };
                  }),
                );
              }}
              onAllPanesEmpty={() => removeTab(tab.id)}
            />
          </div>
        ))}
        {/* Non-session tab: render only when active */}
        {!isActiveSession && activeTab ? renderNonSessionTab(activeTab) : null}
      </>
    );
  };

  // Panel labels based on split direction
  const firstLabel = splitDirection === "horizontal" ? "left" : "top";
  const secondLabel = splitDirection === "horizontal" ? "right" : "bottom";

  const handleUnsplit = (keepPanel: PanelSide) => {
    setLayoutMode(keepPanel === "left" ? "left" : "right");
    setActivePanel(keepPanel);
  };

  const renderTabBar = (
    panelSide: PanelSide,
    activeTabId: string | null,
  ) => (
    <div className="flex items-center gap-2 bg-neutral-900 px-1.5 py-0.5 text-xs">
      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
        {layoutMode === "split"
          ? panelSide === "left" ? firstLabel.charAt(0).toUpperCase() + firstLabel.slice(1) : secondLabel.charAt(0).toUpperCase() + secondLabel.slice(1)
          : "Workspace"}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.length === 0 ? (
          <span className="text-[11px] text-neutral-500">No workspace</span>
        ) : (
          tabs.map((tab) => (
            <span
              key={`${panelSide}-ws-${tab.id}`}
              className={`group/tab flex shrink-0 items-center gap-1 rounded px-0.5 text-xs ${
                activeTabId === tab.id
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {"projectColor" in tab && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tab.projectColor }}
                />
              )}
              <button
                type="button"
                draggable
                onDragStart={(e) => handleTabDragStart(tab.id, e)}
                onDragEnd={handleTabDragEnd}
                onClick={() => assignTabToPanel(tab.id, panelSide)}
                className="cursor-grab py-1 pr-0.5 active:cursor-grabbing"
              >
                {"projectName" in tab && (
                  <span className="font-medium">{tab.projectName}</span>
                )}
                <span className={`${"projectName" in tab ? "ml-1 " : ""}text-neutral-500`}>{tab.title}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="rounded px-1 py-0.5 text-neutral-500 opacity-0 hover:text-neutral-200 group-hover/tab:opacity-100"
                title="Close tab"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      {layoutMode === "split" && (
        <button
          type="button"
          onClick={() => handleUnsplit(panelSide)}
          className="shrink-0 rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
          title="Close split, keep this panel"
        >
          {splitDirection === "horizontal"
            ? panelSide === "left" ? "⇥" : "⇤"
            : panelSide === "left" ? "⇩" : "⇧"}
        </button>
      )}
    </div>
  );

  const isHorizontalSplit = splitDirection === "horizontal";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-950">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={`flex h-full w-full overflow-hidden ${
          layoutMode === "split" && !isHorizontalSplit ? "flex-col" : "flex-row"
        }`}>
          {layoutMode !== "right" ? (
            <section
              className={`min-h-0 min-w-0 overflow-hidden border ${
                activePanel === "left"
                  ? "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.55)]"
                  : "border-transparent"
              }`}
              style={{
                flex: layoutMode === "split" ? `1 1 ${splitRatio * 100}%` : "1 1 100%",
              }}
              onMouseDown={() => setActivePanel("left")}
              onDragOver={(event) => handlePanelDragOver("left", event)}
              onDragLeave={handlePanelDragLeave}
              onDrop={(event) => handleTabDrop("left", event)}
            >
              <div className="flex h-full min-h-0 flex-col">
                {renderTabBar("left", leftTabId)}
                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                  {renderPanelContent(leftTabId)}
                  {dropTarget === "left" && (
                    <div className="pointer-events-none absolute inset-0 z-10 rounded bg-cyan-400/10 ring-2 ring-inset ring-cyan-400/40" />
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {layoutMode === "split" ? (
            <SplitDivider
              direction={splitDirection}
              onDeltaChange={(delta) => {
                setSplitRatio((prev) =>
                  Math.max(0.1, Math.min(0.9, prev + delta)),
                );
              }}
              onReset={() => {
                setSplitRatio(0.5);
              }}
            />
          ) : null}

          {/* Drop zones when in single-panel mode — drag a tab here to split */}
          {layoutMode === "left" && isDraggingTab && (
            <div className="flex min-h-0 min-w-0 flex-col" style={{ flexBasis: "40%" }}>
              {/* Vertical split zone (right side) */}
              <section
                className={`flex min-h-0 flex-1 items-center justify-center border-2 border-dashed transition-colors ${
                  dropZoneHover === "right"
                    ? "border-fuchsia-400/60 bg-fuchsia-400/10"
                    : "border-neutral-700/50 bg-neutral-900/30"
                }`}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes("text/x-orbit-tab-id")) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropZoneHover("right");
                  }
                }}
                onDragLeave={() => setDropZoneHover(null)}
                onDrop={(event) => handleTabDrop("right", event, "horizontal")}
              >
                <span className={`text-xs ${dropZoneHover === "right" ? "text-fuchsia-300/80" : "text-neutral-500"}`}>
                  ← → Split
                </span>
              </section>
              {/* Horizontal split zone (bottom) */}
              <section
                className={`flex min-h-0 flex-1 items-center justify-center border-2 border-dashed transition-colors ${
                  dropZoneHover === "bottom"
                    ? "border-amber-400/60 bg-amber-400/10"
                    : "border-neutral-700/50 bg-neutral-900/30"
                }`}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes("text/x-orbit-tab-id")) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropZoneHover("bottom");
                  }
                }}
                onDragLeave={() => setDropZoneHover(null)}
                onDrop={(event) => handleTabDrop("right", event, "vertical")}
              >
                <span className={`text-xs ${dropZoneHover === "bottom" ? "text-amber-300/80" : "text-neutral-500"}`}>
                  ↑ ↓ Split
                </span>
              </section>
            </div>
          )}

          {layoutMode !== "left" ? (
            <section
              className={`min-h-0 min-w-0 overflow-hidden border ${
                activePanel === "right"
                  ? "border-fuchsia-400 shadow-[0_0_0_1px_rgba(232,121,249,0.55)]"
                  : "border-neutral-800"
              }`}
              style={{
                flex: layoutMode === "split"
                  ? `1 1 ${(1 - splitRatio) * 100}%`
                  : "1 1 100%",
              }}
              onMouseDown={() => setActivePanel("right")}
              onDragOver={(event) => handlePanelDragOver("right", event)}
              onDragLeave={handlePanelDragLeave}
              onDrop={(event) => handleTabDrop("right", event)}
            >
              <div className="flex h-full min-h-0 flex-col">
                {renderTabBar("right", rightTabId)}
                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                  {renderPanelContent(rightTabId)}
                  {dropTarget === "right" && (
                    <div className="pointer-events-none absolute inset-0 z-10 rounded bg-fuchsia-400/10 ring-2 ring-inset ring-fuchsia-400/40" />
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
