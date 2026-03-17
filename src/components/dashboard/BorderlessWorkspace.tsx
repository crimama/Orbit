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
}: BorderlessWorkspaceProps) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activePanel, setActivePanel] = useState<PanelSide>("left");
  const [leftTabId, setLeftTabId] = useState<string | null>(null);
  const [rightTabId, setRightTabId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>("left");
  const [splitDirection, setSplitDirection] = useState<SplitDirection>("horizontal");

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
    if (inlineSessionId === lastInlineSessionIdRef.current) return;
    lastInlineSessionIdRef.current = inlineSessionId;

    const session = inlineSessionId
      ? sessions.find((item) => item.id === inlineSessionId)
      : null;
    if (!session) return;

    if (layoutMode === "split") {
      upsertTab(buildSessionTab(session), activePanel);
    } else {
      upsertTab(buildSessionTab(session), "left");
      setLayoutMode("left");
      setActivePanel("left");
    }
  }, [inlineSessionId, sessions, upsertTab, layoutMode, activePanel]);

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
    upsertTab,
  ]);

  useEffect(() => {
    if (tabs.length === 0) {
      if (leftTabId !== null) setLeftTabId(null);
      if (rightTabId !== null) setRightTabId(null);
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
    direction?: SplitDirection,
  ) => {
    event.preventDefault();
    setDropTarget(null);
    setIsDraggingTab(false);
    setDropZoneHover(null);
    const tabId = event.dataTransfer.getData("text/x-orbit-tab-id");
    if (!tabId) return;
    assignTabToPanel(tabId, panel);
    if (direction) {
      setSplitDirection(direction);
    }
    setLayoutMode("split");
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

  const leftTab = leftTabId ? (tabsById.get(leftTabId) ?? null) : null;
  const rightTab = rightTabId ? (tabsById.get(rightTabId) ?? null) : null;

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

  const renderTabContent = (tab: WorkspaceTab | null) => {
    if (!tab) {
      return (
        <div className="flex h-full items-center justify-center bg-neutral-950 text-sm text-neutral-500">
          Assign a tab to this panel.
        </div>
      );
    }

    if (tab.kind === "session") {
      return (
        <MultiTerminal
          key={tab.id}
          initialSessionId={tab.sessionId}
          runtimeStorageKey={tab.id}
          initialWorkspaceId={inlineWorkspaceId}
          autoRestoreWorkspace={Boolean(inlineWorkspaceId)}
          onKillSession={onKillSession}
        />
      );
    }

    if (tab.kind === "files") {
      return null;
    }

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

    return <ProjectHarnessPanel key={tab.id} projectId={tab.projectId} />;
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
    <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-2 py-1 text-xs">
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
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tab.projectColor }}
              />
              <button
                type="button"
                draggable
                onDragStart={(e) => handleTabDragStart(tab.id, e)}
                onDragEnd={handleTabDragEnd}
                onClick={() => assignTabToPanel(tab.id, panelSide)}
                className="cursor-grab py-1 pr-0.5 active:cursor-grabbing"
              >
                <span className="font-medium">{tab.projectName}</span>
                <span className="ml-1 text-neutral-500">{tab.title}</span>
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={`flex h-full w-full overflow-hidden ${
          layoutMode === "split" && !isHorizontalSplit ? "flex-col" : "flex-row"
        }`}>
          {layoutMode !== "right" ? (
            <section
              className={`min-h-0 min-w-0 overflow-hidden border ${
                activePanel === "left"
                  ? "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.55)]"
                  : "border-neutral-800"
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
                  {renderTabContent(leftTab)}
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
                  {renderTabContent(rightTab)}
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
