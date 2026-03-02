"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import ProjectList from "./ProjectList";
import SessionList from "./SessionList";
import AddProjectForm from "./AddProjectForm";
import AddSshProjectForm from "./AddSshProjectForm";
import AddDockerProjectForm from "./AddDockerProjectForm";
import InterceptorBanner from "./InterceptorBanner";
import InterceptorModal from "./InterceptorModal";
import BorderlessWorkspace from "./BorderlessWorkspace";
import { usePendingApprovals } from "@/lib/hooks/usePendingApprovals";
import type {
  ProjectInfo,
  SessionInfo,
  WorkspaceLayoutInfo,
  GraphState,
  ApiResponse,
  ApiError,
  CreateSessionRequest,
  ProjectFileListResponse,
} from "@/lib/types";

type AddProjectMode = null | "local" | "ssh" | "docker";
type NewSessionAgent = "terminal" | "claude-code" | "codex" | "opencode";
type SessionViewMode = "active" | "all";
type ProjectPaneMode = "terminal" | "files" | "harness";
type ProjectFocusTab = "sessions" | "files" | "harness";

type GlobalFileIndexEntry = {
  projectId: string;
  projectName: string;
  path: string;
  name: string;
  isDir: boolean;
};

type CommandPaletteItem = {
  id: string;
  group: "project" | "session" | "file";
  label: string;
  description: string;
  keywords: string;
  action: () => void;
};

function matchesQuery(item: CommandPaletteItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${item.label} ${item.description} ${item.keywords}`
    .toLowerCase()
    .includes(q);
}

export default function Dashboard() {
  const LEFT_PANEL_MIN_WIDTH = 240;
  const LEFT_PANEL_MAX_WIDTH = 560;
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(
    null,
  );
  const [addProjectMode, setAddProjectMode] = useState<AddProjectMode>(null);
  const [isProjectsListCollapsed, setIsProjectsListCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(288);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionViewMode, setSessionViewMode] =
    useState<SessionViewMode>("active");
  const [, setShowHarnessManager] = useState(false);
  const [projectPaneMode, setProjectPaneMode] =
    useState<ProjectPaneMode>("terminal");
  const [projectFocusTab, setProjectFocusTab] =
    useState<ProjectFocusTab>("sessions");
  const [inlineSessionId, setInlineSessionId] = useState<string | null>(null);
  const [inlineWorkspaceId, setInlineWorkspaceId] = useState<string | null>(
    null,
  );
  const [quickSessionAgent, setQuickSessionAgent] =
    useState<NewSessionAgent>("claude-code");
  const [quickSessionProjectId, setQuickSessionProjectId] = useState("");
  const [quickSessionName, setQuickSessionName] = useState("");
  const [projectSessionName, setProjectSessionName] = useState("");
  const [globalFileIndex, setGlobalFileIndex] = useState<
    GlobalFileIndexEntry[]
  >([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteCursor, setPaletteCursor] = useState(0);
  const layoutSplitRef = useRef<HTMLDivElement>(null);
  const [fileJumpRequest, setFileJumpRequest] = useState<{
    path: string;
    token: number;
  } | null>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const [skillCount, setSkillCount] = useState(0);
  const [globalWorkspaces, setGlobalWorkspaces] = useState<
    WorkspaceLayoutInfo[]
  >([]);
  const [prefillSshProfileId, setPrefillSshProfileId] = useState<string | null>(
    null,
  );
  const [showInterceptorModal, setShowInterceptorModal] = useState(false);
  const { pendingApprovals, approve, deny, latestApproval } =
    usePendingApprovals();

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const json = (await res.json()) as ApiResponse<ProjectInfo[]>;
    if ("data" in json) setProjects(json.data);
  }, []);

  // Fetch sessions
  const fetchSessions = useCallback(async (projectId?: string) => {
    const url = projectId
      ? `/api/sessions?projectId=${projectId}`
      : "/api/sessions";
    const res = await fetch(url);
    const json = (await res.json()) as ApiResponse<SessionInfo[]>;
    if ("data" in json) setSessions(json.data);
  }, []);

  const fetchGlobalWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    const json = (await res.json()) as ApiResponse<WorkspaceLayoutInfo[]>;
    if ("data" in json) setGlobalWorkspaces(json.data);
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchSessions();
    fetchGlobalWorkspaces();
  }, [fetchProjects, fetchSessions, fetchGlobalWorkspaces]);

  useEffect(() => {
    if (projects.length === 0) {
      setQuickSessionProjectId("");
      return;
    }

    if (!quickSessionProjectId) {
      setQuickSessionProjectId(projects[0].id);
      return;
    }

    if (!projects.some((project) => project.id === quickSessionProjectId)) {
      setQuickSessionProjectId(projects[0].id);
    }
  }, [projects, quickSessionProjectId]);

  // When project selected, fetch its sessions
  const handleSelectProject = useCallback(
    (project: ProjectInfo) => {
      setSelectedProject(project);
      setSessionViewMode("active");
      setProjectFocusTab("sessions");
      fetchSessions();
    },
    [fetchSessions],
  );

  const fetchSkillCount = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/skills?projectId=${projectId}`);
    const json = (await res.json()) as ApiResponse<GraphState>;
    if ("data" in json) {
      setSkillCount(json.data.nodes.length);
    }
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setSkillCount(0);
      return;
    }
    void fetchSkillCount(selectedProject.id);
  }, [selectedProject, fetchSkillCount]);

  const patchProject = useCallback(
    async (id: string, updates: Partial<ProjectInfo>) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = (await res.json()) as ApiResponse<ProjectInfo>;
      if ("data" in json) {
        setProjects((prev) => prev.map((p) => (p.id === id ? json.data : p)));
        if (selectedProject?.id === id) {
          setSelectedProject(json.data);
        }
      }
    },
    [selectedProject],
  );

  const handleRenameProject = useCallback(
    (id: string, newName: string) => patchProject(id, { name: newName }),
    [patchProject],
  );

  const handleChangeProjectColor = useCallback(
    (id: string, color: string) => patchProject(id, { color }),
    [patchProject],
  );

  const handleUpdateProjectConfig = useCallback(
    (id: string, update: { path: string; dockerContainer?: string | null }) =>
      patchProject(id, update),
    [patchProject],
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        fetchSessions();
      }
      fetchProjects();
    },
    [selectedProject, fetchProjects, fetchSessions],
  );

  const handleTerminateSession = useCallback(
    async (id: string) => {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      fetchSessions();
    },
    [fetchSessions],
  );

  const handleRenameSession = useCallback(
    async (id: string, newName: string) => {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      fetchSessions();
    },
    [fetchSessions],
  );

  const createSession = useCallback(
    async (
      request: CreateSessionRequest,
      options?: { activateInWorkspace?: boolean },
    ) => {
      setCreatingSession(true);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const json = (await res.json()) as ApiResponse<SessionInfo>;
        if ("data" in json) {
          if (options?.activateInWorkspace !== false) {
            setInlineSessionId(json.data.id);
            setInlineWorkspaceId(null);
          }
          fetchSessions();
        }
      } finally {
        setCreatingSession(false);
      }
    },
    [fetchSessions],
  );

  const handleResumeClaudeSession = useCallback(
    async (sessionRef: string) => {
      if (!selectedProject) return;
      await createSession({
        projectId: selectedProject!.id,
        agentType: "claude-code",
        resumeSessionRef: sessionRef,
      });
    },
    [createSession, selectedProject],
  );

  const handleQuickCreateSession = useCallback(async () => {
    const projectId = quickSessionProjectId || projects[0]?.id;
    if (!projectId) return;

    const project = projects.find((item) => item.id === projectId);
    if (project) {
      setSelectedProject(project);
    }

    setSessionViewMode("active");
    setProjectFocusTab("sessions");
    setShowHarnessManager(false);
    setProjectPaneMode("terminal");

    await createSession({
      projectId,
      agentType: quickSessionAgent,
      name: quickSessionName.trim() || undefined,
    });
    setQuickSessionName("");
  }, [
    quickSessionProjectId,
    projects,
    createSession,
    quickSessionAgent,
    quickSessionName,
  ]);

  const handleCreateSelectedProjectSession = useCallback(async () => {
    if (!selectedProject) return;

    setSessionViewMode("active");

    await createSession(
      {
        projectId: selectedProject.id,
        agentType: quickSessionAgent,
        name: projectSessionName.trim() || undefined,
      },
      { activateInWorkspace: false },
    );
    setProjectSessionName("");
  }, [selectedProject, createSession, quickSessionAgent, projectSessionName]);

  const handleProjectCreated = useCallback(
    (project: ProjectInfo) => {
      setProjects((prev) => [project, ...prev]);
      setAddProjectMode(null);
      setPrefillSshProfileId(null);
      handleSelectProject(project);
    },
    [handleSelectProject],
  );

  const handleGoHome = useCallback(() => {
    setSelectedProject(null);
    setProjectFocusTab("sessions");
    setIsProjectsListCollapsed(false);
    setAddProjectMode(null);
    setPrefillSshProfileId(null);
    setSessionViewMode("all");
    setShowHarnessManager(false);
    setProjectPaneMode("terminal");
    setInlineSessionId(null);
    setInlineWorkspaceId(null);
    fetchSessions();
  }, [fetchSessions]);

  const extractFirstActiveSessionId = useCallback(
    (workspace: WorkspaceLayoutInfo): string | null => {
      try {
        const parsed = JSON.parse(workspace.tree) as unknown;
        const candidateIds: string[] = [];

        const walk = (node: unknown): void => {
          if (!node || typeof node !== "object") return;
          const value = node as {
            type?: string;
            sessionId?: string | null;
            children?: unknown[];
          };
          if (value.type === "leaf") {
            if (typeof value.sessionId === "string" && value.sessionId.trim()) {
              candidateIds.push(value.sessionId);
            }
            return;
          }
          if (value.type === "split" && Array.isArray(value.children)) {
            for (const child of value.children) {
              walk(child);
            }
          }
        };

        walk(parsed);

        const activeSet = new Set(
          sessions.filter((s) => s.status === "active").map((s) => s.id),
        );
        return candidateIds.find((id) => activeSet.has(id)) ?? null;
      } catch {
        return null;
      }
    },
    [sessions],
  );

  const handleOpenGlobalWorkspace = useCallback(
    (workspace: WorkspaceLayoutInfo) => {
      const targetSessionId = extractFirstActiveSessionId(workspace);
      if (!targetSessionId) return;

      const targetSession = sessions.find(
        (session) => session.id === targetSessionId,
      );
      if (!targetSession) return;

      const project = projects.find((p) => p.id === targetSession.projectId);
      if (project) {
        setSelectedProject(project);
      }

      setSessionViewMode("active");
      setProjectFocusTab("sessions");
      setShowHarnessManager(false);
      setProjectPaneMode("terminal");
      setInlineSessionId(targetSession.id);
      setInlineWorkspaceId(workspace.id);
      void fetchSessions();
    },
    [extractFirstActiveSessionId, sessions, projects, fetchSessions],
  );

  const getWorkspaceLaunchSessionId = useCallback(
    (workspace: WorkspaceLayoutInfo): string | null => {
      return extractFirstActiveSessionId(workspace);
    },
    [extractFirstActiveSessionId],
  );

  const visibleSessions = useMemo(() => {
    if (sessionViewMode === "all") return sessions;
    return sessions.filter((s) => s.status === "active");
  }, [sessionViewMode, sessions]);

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions],
  );

  const selectedProjectSessions = useMemo(() => {
    if (!selectedProject) return [];
    return visibleSessions.filter(
      (session) => session.projectId === selectedProject.id,
    );
  }, [selectedProject, visibleSessions]);

  const selectedProjectFiles = useMemo(() => {
    if (!selectedProject) return [];
    return globalFileIndex.filter(
      (row) => row.projectId === selectedProject.id,
    );
  }, [selectedProject, globalFileIndex]);

  useEffect(() => {
    if (!selectedProject || !inlineSessionId) return;

    const currentInlineSession = sessions.find(
      (session) => session.id === inlineSessionId,
    );
    if (!currentInlineSession || currentInlineSession.status !== "active") {
      setInlineSessionId(null);
    }
  }, [selectedProject, inlineSessionId, sessions]);

  const handleOpenSessionFromList = useCallback(
    (sessionId: string) => {
      const targetSession = sessions.find(
        (session) => session.id === sessionId,
      );
      if (targetSession) {
        const project = projects.find(
          (item) => item.id === targetSession.projectId,
        );
        if (project) {
          setSelectedProject(project);
        }
      }

      setSessionViewMode("active");
      setProjectFocusTab("sessions");
      setShowHarnessManager(false);
      setProjectPaneMode("terminal");
      setInlineSessionId(sessionId);
      setInlineWorkspaceId(null);
    },
    [sessions, projects],
  );

  const openSessionInDashboard = useCallback(
    (session: SessionInfo) => {
      const project = projects.find((p) => p.id === session.projectId);
      if (project) {
        setSelectedProject(project);
      }

      setSessionViewMode("active");
      setProjectFocusTab("sessions");
      setShowHarnessManager(false);
      setProjectPaneMode("terminal");
      setInlineSessionId(session.id);
      setInlineWorkspaceId(null);
      void fetchSessions();
    },
    [projects, fetchSessions],
  );

  const openFileInProject = useCallback(
    (projectId: string, filePath: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const currentInlineSession = inlineSessionId
        ? (sessions.find((session) => session.id === inlineSessionId) ?? null)
        : null;
      const activeProjectSession = sessions.find(
        (session) =>
          session.projectId === projectId && session.status === "active",
      );

      const nextInlineSessionId =
        currentInlineSession?.projectId === projectId
          ? currentInlineSession.id
          : (activeProjectSession?.id ?? null);

      setSelectedProject(project);
      setSessionViewMode("active");
      setProjectFocusTab("files");
      setShowHarnessManager(false);
      setProjectPaneMode("terminal");
      setInlineSessionId(nextInlineSessionId);
      setInlineWorkspaceId(null);
      setFileJumpRequest({ path: filePath, token: Date.now() });
      setPaletteOpen(false);
    },
    [projects, inlineSessionId, sessions],
  );

  const handleCloseFocusedFileView = useCallback(() => {
    if (!selectedProject) return;

    const currentInlineSession =
      inlineSessionId != null
        ? (sessions.find((session) => session.id === inlineSessionId) ?? null)
        : null;
    const activeProjectSession = sessions.find(
      (session) =>
        session.projectId === selectedProject.id && session.status === "active",
    );

    const nextInlineSessionId =
      currentInlineSession?.projectId === selectedProject.id
        ? currentInlineSession.id
        : (activeProjectSession?.id ?? null);

    setProjectFocusTab("sessions");
    setProjectPaneMode("terminal");
    setInlineSessionId(nextInlineSessionId);
    setFileJumpRequest(null);
  }, [selectedProject, inlineSessionId, sessions]);

  useEffect(() => {
    let cancelled = false;
    async function buildGlobalFileIndex() {
      const rows: GlobalFileIndexEntry[] = [];
      await Promise.all(
        projects.map(async (project) => {
          try {
            const query = new URLSearchParams({ path: "" }).toString();
            const res = await fetch(
              `/api/projects/${project.id}/files/list?${query}`,
              { cache: "no-store" },
            );
            if (!res.ok) return;
            const json = (await res.json()) as
              | ApiResponse<ProjectFileListResponse>
              | ApiError;
            if (!("data" in json)) return;
            for (const entry of json.data.entries) {
              rows.push({
                projectId: project.id,
                projectName: project.name,
                path: entry.path,
                name: entry.name,
                isDir: entry.isDir,
              });
            }
          } catch {}
        }),
      );
      if (!cancelled) {
        setGlobalFileIndex(rows.slice(0, 400));
      }
    }
    void buildGlobalFileIndex();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const paletteItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [];

    for (const project of projects) {
      items.push({
        id: `project:${project.id}`,
        group: "project",
        label: project.name,
        description: `Project (${project.type})`,
        keywords: `${project.path} ${project.type}`,
        action: () => {
          handleSelectProject(project);
          setPaletteOpen(false);
        },
      });
    }

    for (const session of sessions) {
      items.push({
        id: `session:${session.id}`,
        group: "session",
        label: session.name || session.id.slice(0, 8),
        description: `${session.projectName} · ${session.status}`,
        keywords: `${session.projectName} ${session.status} ${session.agentType}`,
        action: () => {
          openSessionInDashboard(session);
          setPaletteOpen(false);
        },
      });
    }

    for (const file of globalFileIndex) {
      if (file.isDir) continue;
      items.push({
        id: `file:${file.projectId}:${file.path}`,
        group: "file",
        label: file.name,
        description: `${file.projectName} · ${file.path}`,
        keywords: `${file.projectName} ${file.path}`,
        action: () => openFileInProject(file.projectId, file.path),
      });
    }

    return items;
  }, [
    projects,
    sessions,
    globalFileIndex,
    handleSelectProject,
    openSessionInDashboard,
    openFileInProject,
  ]);

  const paletteResults = useMemo(() => {
    return paletteItems
      .filter((item) => matchesQuery(item, paletteQuery))
      .slice(0, 40);
  }, [paletteItems, paletteQuery]);

  useEffect(() => {
    if (!paletteOpen) return;
    setPaletteCursor(0);
    const id = window.setTimeout(() => {
      paletteInputRef.current?.focus();
      paletteInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [paletteOpen]);

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        Boolean(target?.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      if (!paletteOpen || isEditable) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setPaletteOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteCursor((prev) =>
          Math.min(prev + 1, Math.max(0, paletteResults.length - 1)),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteCursor((prev) => Math.max(0, prev - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = paletteResults[paletteCursor];
        selected?.action();
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [paletteCursor, paletteOpen, paletteResults]);

  const dockSessions = useMemo(() => {
    return sessions.filter((s) => s.status !== "terminated").slice(0, 14);
  }, [sessions]);

  const startLeftPanelResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!layoutSplitRef.current) return;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const container = layoutSplitRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const maxWidth = Math.min(
          LEFT_PANEL_MAX_WIDTH,
          Math.max(LEFT_PANEL_MIN_WIDTH, rect.width - 320),
        );
        const nextWidth = Math.min(
          maxWidth,
          Math.max(LEFT_PANEL_MIN_WIDTH, moveEvent.clientX - rect.left),
        );

        setLeftPanelWidth(nextWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [LEFT_PANEL_MAX_WIDTH, LEFT_PANEL_MIN_WIDTH],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-y-auto bg-[#0a0a0a] pb-12 text-neutral-200 md:h-[100dvh] md:overflow-hidden">
      {/* Interceptor Banner */}
      <InterceptorBanner
        pendingCount={pendingApprovals.length}
        latestCommand={latestApproval?.command}
        onClick={() => setShowInterceptorModal(true)}
      />

      {/* Interceptor Modal */}
      {showInterceptorModal && latestApproval && (
        <InterceptorModal
          approval={latestApproval}
          onApprove={() => {
            approve(latestApproval.id);
            setShowInterceptorModal(false);
          }}
          onDeny={() => {
            deny(latestApproval.id);
            setShowInterceptorModal(false);
          }}
        />
      )}

      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2 sm:px-4">
        <h1 className="text-sm font-bold tracking-wide text-neutral-300">
          Agent Orbit
        </h1>
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <button
            onClick={handleGoHome}
            className="rounded px-3 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            Home
          </button>
          {selectedProject && (
            <Link
              href={`/graph?projectId=${selectedProject.id}`}
              className="rounded px-3 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            >
              Skill Graph
            </Link>
          )}
          <Link
            href="/compare"
            className="rounded px-3 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            A/B Compare
          </Link>
        </div>
      </div>

      <div
        ref={layoutSplitRef}
        className="flex flex-1 flex-col md:min-h-0 md:flex-row md:overflow-hidden"
      >
        {/* Left Panel — Projects */}
        <div
          className="flex min-h-[260px] w-full flex-col border-b border-neutral-800 md:min-h-0 md:flex-none md:border-b-0 md:border-r"
          style={{
            width: isProjectsListCollapsed ? "5rem" : `${leftPanelWidth}px`,
          }}
        >
          <div
            className={`flex min-w-0 items-center gap-2 border-b border-neutral-800 py-3 ${
              isProjectsListCollapsed
                ? "justify-center px-2"
                : "justify-between px-4"
            }`}
          >
            {!isProjectsListCollapsed ? (
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Projects
              </span>
            ) : null}
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setIsProjectsListCollapsed((prev) => !prev)}
                className="flex h-7 w-7 items-center justify-center rounded border border-neutral-700 bg-neutral-900 text-sm font-semibold text-neutral-200 hover:bg-neutral-800"
                title={
                  isProjectsListCollapsed
                    ? "Expand projects"
                    : "Collapse projects"
                }
              >
                {isProjectsListCollapsed ? "▶" : "◀"}
              </button>
            </div>
          </div>

          {!isProjectsListCollapsed && addProjectMode !== null ? (
            <div className="max-h-[55vh] overflow-y-auto border-b border-neutral-800 p-2">
              <div className="mb-2 flex rounded border border-neutral-700 bg-neutral-900 p-0.5">
                <button
                  onClick={() => setAddProjectMode("local")}
                  className={`flex-1 rounded px-2 py-1 text-xs ${
                    addProjectMode === "local"
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Local
                </button>
                <button
                  onClick={() => setAddProjectMode("ssh")}
                  className={`flex-1 rounded px-2 py-1 text-xs ${
                    addProjectMode === "ssh"
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  SSH
                </button>
                <button
                  onClick={() => setAddProjectMode("docker")}
                  className={`flex-1 rounded px-2 py-1 text-xs ${
                    addProjectMode === "docker"
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Docker
                </button>
              </div>
              {addProjectMode === "local" ? (
                <AddProjectForm onCreated={handleProjectCreated} />
              ) : null}
              {addProjectMode === "ssh" ? (
                <AddSshProjectForm
                  onCreated={handleProjectCreated}
                  initialProfileId={prefillSshProfileId}
                />
              ) : null}
              {addProjectMode === "docker" ? (
                <AddDockerProjectForm onCreated={handleProjectCreated} />
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isProjectsListCollapsed ? (
              <div className="px-2 py-4 text-center text-xs tracking-wide text-neutral-500">
                Projects
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                  <span className="text-xs text-neutral-500">Projects</span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedProject(null);
                        setInlineSessionId(null);
                        setInlineWorkspaceId(null);
                        setProjectFocusTab("sessions");
                        setProjectPaneMode("terminal");
                        setShowHarnessManager(false);
                      }}
                      className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      Home
                    </button>
                    <button
                      onClick={() =>
                        setAddProjectMode(
                          addProjectMode === null ? "local" : null,
                        )
                      }
                      className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      {addProjectMode === null ? "+ Project" : "Cancel"}
                    </button>
                  </div>
                </div>

                {selectedProject ? (
                  <div className="border-b border-neutral-800 px-3 py-2">
                    <div className="mb-2 flex items-center gap-2 text-xs text-neutral-400">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: selectedProject.color }}
                      />
                      <span className="truncate">{selectedProject.name}</span>
                    </div>

                    <div className="mb-2 inline-flex w-full rounded border border-neutral-700 bg-neutral-900 p-0.5 text-xs">
                      <button
                        onClick={() => {
                          setProjectFocusTab("sessions");
                          setProjectPaneMode("terminal");
                          setShowHarnessManager(false);
                        }}
                        className={`flex-1 rounded px-2 py-1 ${
                          projectFocusTab === "sessions"
                            ? "bg-neutral-700 text-neutral-100"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Sessions
                      </button>
                      <button
                        onClick={() => {
                          setProjectFocusTab("files");
                          setShowHarnessManager(false);
                        }}
                        className={`flex-1 rounded px-2 py-1 ${
                          projectFocusTab === "files"
                            ? "bg-neutral-700 text-neutral-100"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Files
                      </button>
                      <button
                        onClick={() => {
                          setProjectFocusTab("harness");
                          setProjectPaneMode("harness");
                          setShowHarnessManager(true);
                        }}
                        className={`flex-1 rounded px-2 py-1 ${
                          projectFocusTab === "harness"
                            ? "bg-neutral-700 text-neutral-100"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Harness
                      </button>
                    </div>

                    {projectFocusTab === "sessions" ? (
                      <div className="max-h-72 overflow-y-auto rounded border border-neutral-800 bg-neutral-900/40">
                        <div className="grid grid-cols-1 gap-2 border-b border-neutral-800 p-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                          <input
                            value={projectSessionName}
                            onChange={(e) =>
                              setProjectSessionName(e.target.value)
                            }
                            placeholder="Session name (recommended)"
                            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                          />
                          <select
                            value={quickSessionAgent}
                            onChange={(e) =>
                              setQuickSessionAgent(
                                e.target.value as NewSessionAgent,
                              )
                            }
                            className="min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                          >
                            <option value="terminal">Terminal</option>
                            <option value="claude-code">Claude Code</option>
                            <option value="codex">Codex</option>
                            <option value="opencode">OpenCode</option>
                          </select>
                          <button
                            onClick={() => {
                              void handleCreateSelectedProjectSession();
                            }}
                            disabled={creatingSession}
                            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {creatingSession ? "Creating..." : "+ New"}
                          </button>
                        </div>
                        <SessionList
                          sessions={selectedProjectSessions}
                          onTerminate={handleTerminateSession}
                          onResume={handleResumeClaudeSession}
                          onRename={handleRenameSession}
                          onOpenSession={handleOpenSessionFromList}
                        />
                      </div>
                    ) : null}

                    {projectFocusTab === "files" ? (
                      <div className="max-h-72 overflow-y-auto rounded border border-neutral-800 bg-neutral-900/40 p-1">
                        {selectedProjectFiles.length === 0 ? (
                          <div className="px-2 py-6 text-center text-xs text-neutral-500">
                            No indexed files.
                          </div>
                        ) : (
                          selectedProjectFiles.slice(0, 80).map((row) => (
                            <button
                              key={`left-file-${row.projectId}:${row.path}`}
                              onClick={() => {
                                if (row.isDir) return;
                                openFileInProject(row.projectId, row.path);
                              }}
                              className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${
                                row.isDir
                                  ? "cursor-default text-amber-300/90"
                                  : "text-neutral-300 hover:bg-neutral-800"
                              }`}
                              title={row.path}
                              type="button"
                            >
                              <span className="w-3 text-center">
                                {row.isDir ? "▸" : "•"}
                              </span>
                              <span className="flex-1 truncate">
                                {row.name}
                                {row.isDir ? "/" : ""}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}

                    {projectFocusTab === "harness" ? (
                      <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3">
                        <div className="mb-2 text-xs text-neutral-400">
                          Skills linked to this project
                        </div>
                        <div className="mb-3 text-2xl font-semibold text-cyan-300">
                          {skillCount}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setProjectPaneMode("harness");
                              setShowHarnessManager(true);
                            }}
                            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                          >
                            Open Harness
                          </button>
                          <Link
                            href={`/graph?projectId=${selectedProject.id}`}
                            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                          >
                            Manage Skills
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <ProjectList
                  projects={projects}
                  selectedId={selectedProject?.id ?? null}
                  onSelect={handleSelectProject}
                  onDelete={handleDeleteProject}
                  onRename={handleRenameProject}
                  onUpdateConfig={handleUpdateProjectConfig}
                  onChangeColor={handleChangeProjectColor}
                />
              </>
            )}
          </div>
        </div>

        {!isProjectsListCollapsed ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize left panel"
            onMouseDown={startLeftPanelResize}
            className="hidden w-1 shrink-0 cursor-col-resize bg-neutral-800 transition-colors hover:bg-cyan-500 md:block"
          />
        ) : null}

        {/* Right Panel — Sessions */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedProject ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {projectPaneMode === "harness" && (
                  <div className="border-b border-neutral-800 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-neutral-500">
                        Skills: {skillCount}
                      </span>
                      <Link
                        href={`/graph?projectId=${selectedProject.id}`}
                        className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                      >
                        Manage Skills
                      </Link>
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1 p-2 sm:p-3">
                  {projectFocusTab === "sessions" && !inlineSessionId ? (
                    <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 text-center text-sm text-neutral-500">
                      Select a session from the left panel to open a terminal.
                    </div>
                  ) : (
                    <BorderlessWorkspace
                      sessions={sessions}
                      selectedProject={selectedProject}
                      projectPaneMode={projectPaneMode}
                      inlineSessionId={inlineSessionId}
                      inlineWorkspaceId={inlineWorkspaceId}
                      initialFilePath={fileJumpRequest?.path ?? null}
                      initialFilePathToken={fileJumpRequest?.token ?? null}
                      onCloseFileView={handleCloseFocusedFileView}
                      onKillSession={handleTerminateSession}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <div className="text-xs text-neutral-500">Projects</div>
                    <div className="mt-1 text-2xl font-semibold text-neutral-200">
                      {projects.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <div className="text-xs text-neutral-500">
                      Active Sessions
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-green-400">
                      {activeSessions.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <div className="text-xs text-neutral-500">
                      Pending Approvals
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-amber-400">
                      {pendingApprovals.length}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="mb-2 text-xs text-neutral-500">
                    Quick Session Launch
                  </div>
                  {projects.length === 0 ? (
                    <p className="text-sm text-neutral-600">
                      Add a project first, then launch sessions here.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px_160px_auto]">
                      <input
                        value={quickSessionName}
                        onChange={(e) => setQuickSessionName(e.target.value)}
                        placeholder="Session name (recommended)"
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                      />
                      <select
                        value={quickSessionProjectId}
                        onChange={(e) =>
                          setQuickSessionProjectId(e.target.value)
                        }
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                      >
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={quickSessionAgent}
                        onChange={(e) =>
                          setQuickSessionAgent(
                            e.target.value as NewSessionAgent,
                          )
                        }
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                      >
                        <option value="terminal">Terminal</option>
                        <option value="claude-code">Claude Code</option>
                        <option value="codex">Codex</option>
                        <option value="opencode">OpenCode</option>
                      </select>
                      <button
                        onClick={handleQuickCreateSession}
                        disabled={creatingSession}
                        className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {creatingSession ? "Starting..." : "Start"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="mb-2 text-xs text-neutral-500">
                    Active Sessions (All)
                  </div>
                  {activeSessions.length === 0 ? (
                    <p className="text-sm text-neutral-600">
                      No active sessions.
                    </p>
                  ) : (
                    <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                      {activeSessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => openSessionInDashboard(s)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-neutral-300 hover:bg-neutral-800"
                          style={{
                            borderLeft: `2px solid ${s.projectColor}`,
                          }}
                        >
                          <span className="flex-1 truncate">
                            {s.projectName} / {s.name ?? s.id.slice(0, 8)}
                          </span>
                          <span className="text-green-400">active</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="mb-2 text-xs text-neutral-500">
                    Saved Workspaces (Global)
                  </div>
                  {globalWorkspaces.length === 0 ? (
                    <p className="text-sm text-neutral-600">
                      No saved workspace yet.
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                      {globalWorkspaces.map((workspace) => {
                        const launchSessionId =
                          getWorkspaceLaunchSessionId(workspace);
                        return (
                          <button
                            key={workspace.id}
                            onClick={() => handleOpenGlobalWorkspace(workspace)}
                            disabled={!launchSessionId}
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
                            title={
                              launchSessionId
                                ? "Open workspace"
                                : "No active session found in this workspace"
                            }
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{workspace.name}</p>
                              <p className="text-[11px] text-neutral-500">
                                Updated{" "}
                                {new Date(workspace.updatedAt).toLocaleString()}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {paletteOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="mx-auto mt-[12vh] w-[min(760px,94vw)] rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-neutral-800 p-3">
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search projects, files, sessions (running/error/completed)..."
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              />
            </div>
            <div className="max-h-[58vh] overflow-y-auto p-2">
              {paletteResults.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-neutral-500">
                  No results
                </p>
              ) : (
                paletteResults.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className={`mb-1 flex w-full items-start justify-between rounded px-3 py-2 text-left ${
                      index === paletteCursor
                        ? "bg-neutral-800 text-neutral-100"
                        : "text-neutral-300 hover:bg-neutral-800/70"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {item.description}
                      </span>
                    </span>
                    <span className="ml-2 rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                      {item.group}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto px-3 py-1.5">
          <span className="shrink-0 text-[11px] uppercase tracking-wide text-neutral-500">
            Global Session Dock
          </span>
          {dockSessions.length === 0 ? (
            <span className="text-xs text-neutral-600">No active sessions</span>
          ) : (
            dockSessions.map((session) => {
              const statusClass =
                session.status === "active"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : session.status === "paused"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-300";
              return (
                <button
                  key={`dock-${session.id}`}
                  onClick={() => openSessionInDashboard(session)}
                  className={`shrink-0 rounded border px-2 py-1 text-xs transition-colors hover:bg-neutral-800 ${statusClass}`}
                >
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />
                  {session.projectName} /{" "}
                  {session.name || session.id.slice(0, 8)}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
