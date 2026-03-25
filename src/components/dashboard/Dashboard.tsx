"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import ProjectList from "./ProjectList";
import SessionList from "./SessionList";
import SidebarFileTree from "./SidebarFileTree";
import AddProjectForm from "./AddProjectForm";
import AddSshProjectForm from "./AddSshProjectForm";
import AddDockerProjectForm from "./AddDockerProjectForm";
import InterceptorBanner from "./InterceptorBanner";
import InterceptorModal from "./InterceptorModal";
import BorderlessWorkspace from "./BorderlessWorkspace";
import SshVaultPanel from "./SshVaultPanel";
import CostDashboard from "./CostDashboard";
import AuditLogPanel from "./AuditLogPanel";
import { usePendingApprovals } from "@/lib/hooks/usePendingApprovals";
import { useSocket } from "@/lib/useSocket";
import type {
  ProjectInfo,
  SessionInfo,
  GraphState,
  ApiResponse,
  ApiError,
  CreateSessionRequest,
  ProjectFileListResponse,
  SessionContext,
  SessionNotification,
} from "@/lib/types";

type AddProjectMode = null | "local" | "ssh" | "docker";
type SshFormMode = "project" | "vault";
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
  const LEFT_PANEL_MIN_WIDTH = 200;
  const LEFT_PANEL_MAX_WIDTH = 560;
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(
    null,
  );
  const [addProjectMode, setAddProjectMode] = useState<AddProjectMode>(null);
  const [isProjectsListCollapsed, setIsProjectsListCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
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
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [sessionContexts, setSessionContexts] = useState<Map<string, SessionContext>>(new Map());
  const [notifications, setNotifications] = useState<SessionNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifBellRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const [globalFileIndex, setGlobalFileIndex] = useState<
    GlobalFileIndexEntry[]
  >([]);
  const [viewedFile, setViewedFile] = useState<{
    projectId: string;
    path: string;
    content: string;
  } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteCursor, setPaletteCursor] = useState(0);
  const layoutSplitRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const [skillCount, setSkillCount] = useState(0);
  const [projectDirMap, setProjectDirMap] = useState<Record<string, string>>({});
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editingProjectNameValue, setEditingProjectNameValue] = useState("");
  const [prefillSshProfileId, setPrefillSshProfileId] = useState<string | null>(
    null,
  );
  const [sshFormMode, setSshFormMode] = useState<SshFormMode>("project");
  const editingSshProfileId = sshFormMode === "vault" ? prefillSshProfileId : null;
  const [showInterceptorModal, setShowInterceptorModal] = useState(false);
  const { socket } = useSocket();
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

  useEffect(() => {
    fetchProjects();
    fetchSessions();
  }, [fetchProjects, fetchSessions]);

  // Close notification panel on outside click
  useEffect(() => {
    if (!showNotifications) return;
    function handleClick(e: MouseEvent) {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
        notifBellRef.current && !notifBellRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifications]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    void Notification.requestPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleSessionUpdate = (session: SessionInfo) => {
      setSessions((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === session.id);
        const previous =
          existingIndex >= 0 ? prev[existingIndex] : null;

        if (
          previous?.status !== "terminated" &&
          session.status === "terminated" &&
          typeof document !== "undefined" &&
          document.hidden &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("Session Ended", {
            body: `${session.name ?? session.id.slice(0, 8)} exited`,
            icon: "/icon-192x192.png",
          });
        }

        if (existingIndex === -1) {
          return [session, ...prev];
        }

        const next = [...prev];
        next[existingIndex] = session;
        return next;
      });
    };

    socket.emit("dashboard-join");
    socket.on("session-update", handleSessionUpdate);

    const handleSessionContext = (ctx: SessionContext) => {
      setSessionContexts((prev) => {
        const existing = prev.get(ctx.sessionId);
        if (existing?.cwd === ctx.cwd && existing?.gitBranch === ctx.gitBranch) return prev;
        const next = new Map(prev);
        next.set(ctx.sessionId, { ...existing, ...ctx });
        return next;
      });
    };
    socket.on("session-context" as never, handleSessionContext);

    const handleSessionNotify = (n: SessionNotification) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
    };
    socket.on("session-notify" as never, handleSessionNotify);

    return () => {
      socket.off("session-update", handleSessionUpdate);
      socket.off("session-context" as never, handleSessionContext);
      socket.off("session-notify" as never, handleSessionNotify);
    };
  }, [socket]);

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

  // When project selected, fetch its sessions — preserve sidebar tab, reset right pane file view
  const handleSelectProject = useCallback(
    (project: ProjectInfo) => {
      setSelectedProject(project);
      if (projectPaneMode === "files") {
        setProjectPaneMode("terminal");
      }
      fetchSessions();
    },
    [fetchSessions, projectPaneMode],
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

  const [killedSessionId, setKilledSessionId] = useState<string | null>(null);

  const handleTerminateSession = useCallback(
    async (id: string) => {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      setKilledSessionId(id);
      fetchSessions();
    },
    [fetchSessions],
  );

  const handleTerminateAndRestart = useCallback(
    async (id: string, options: { dangerouslySkipPermissions: boolean }) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: session.projectId,
          agentType: session.agentType,
          dangerouslySkipPermissions: options.dangerouslySkipPermissions,
        }),
      });
      const json = (await res.json()) as ApiResponse<SessionInfo>;
      if ("data" in json) {
        setInlineSessionId(json.data.id);
      }
      fetchSessions();
    },
    [sessions, fetchSessions],
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
        console.log("[createSession] API response:", JSON.stringify(json).slice(0, 200));
        if ("data" in json) {
          console.log("[createSession] new session id:", json.data.id, "activateInWorkspace:", options?.activateInWorkspace !== false);
          if (options?.activateInWorkspace !== false) {
            setInlineSessionId(json.data.id);
            setInlineWorkspaceId(null);
          }
          await fetchSessions();
        } else {
          console.error("[createSession] API error:", json);
        }
      } finally {
        setCreatingSession(false);
      }
    },
    [fetchSessions],
  );

  const handleResumeSession = useCallback(
    async (sessionRef: string, agentType?: string, projectId?: string) => {
      const pid = projectId ?? selectedProject?.id;
      if (!pid) return;

      // Ensure the correct project is selected and sidebar shows active sessions
      if (projectId) {
        const project = projects.find((p) => p.id === projectId);
        if (project) setSelectedProject(project);
      }
      setSessionViewMode("active");
      setProjectFocusTab("sessions");

      await createSession({
        projectId: pid,
        agentType: (agentType as NewSessionAgent) || "claude-code",
        resumeSessionRef: sessionRef,
      });
    },
    [createSession, selectedProject, projects],
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

    const autoName = quickSessionName.trim() || `${quickSessionAgent} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    await createSession({
      projectId,
      agentType: quickSessionAgent,
      name: autoName,
      ...(skipPermissions && quickSessionAgent === "claude-code" && { dangerouslySkipPermissions: true }),
    });
    setQuickSessionName("");
  }, [
    quickSessionProjectId,
    projects,
    createSession,
    quickSessionAgent,
    quickSessionName,
    skipPermissions,
  ]);

  const handleCreateSelectedProjectSession = useCallback(async () => {
    if (!selectedProject) return;

    setSessionViewMode("active");

    const autoName = projectSessionName.trim() || `${quickSessionAgent} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    await createSession(
      {
        projectId: selectedProject.id,
        agentType: quickSessionAgent,
        name: autoName,
        ...(skipPermissions && quickSessionAgent === "claude-code" && { dangerouslySkipPermissions: true }),
      },
      { activateInWorkspace: true },
    );
    setProjectSessionName("");
  }, [selectedProject, createSession, quickSessionAgent, projectSessionName, skipPermissions]);

  const handleProjectCreated = useCallback(
    (project: ProjectInfo) => {
      setProjects((prev) => [project, ...prev]);
      setAddProjectMode(null);
      setPrefillSshProfileId(null);
      setSshFormMode("project");

      handleSelectProject(project);
    },
    [handleSelectProject],
  );

  const handleVaultQuickConnect = useCallback(
    (session: SessionInfo) => {
      setInlineSessionId(session.id);
      setSessions((prev) =>
        prev.some((s) => s.id === session.id) ? prev : [session, ...prev],
      );
    },
    [],
  );

  const openSshProjectForm = useCallback((profileId?: string | null) => {
    setPrefillSshProfileId(profileId ?? null);
    setSshFormMode("project");
    setAddProjectMode("ssh");
  }, []);

  const openSshVaultForm = useCallback((profileId?: string | null) => {
    setPrefillSshProfileId(profileId ?? null);
    setSshFormMode("vault");
    setAddProjectMode("ssh");
  }, []);


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

  // NOTE: Removed the useEffect that cleared inlineSessionId when
  // session status !== "active". It prevented resuming terminated
  // sessions because ensureSessionRunning re-activates them on attach,
  // but this effect would null-out the ID before attach could fire.

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
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;
      setSelectedProject(project);
      setProjectFocusTab("files");
      setPaletteOpen(false);
    },
    [projects],
  );



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
        action: () => openFileInProject(file.projectId),
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
    <div className="flex min-h-[100dvh] flex-col overflow-y-auto bg-[#0a0a0a] pb-12 text-neutral-200 md:h-[100dvh] md:overflow-hidden md:pb-0">
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1 sm:px-4">
        <h1 className="text-sm font-bold tracking-wide text-neutral-300">
          Agent Orbit
        </h1>
        <div className="relative flex flex-wrap items-center gap-1 sm:gap-2">
          <button
            ref={notifBellRef}
            onClick={() => setShowNotifications((v) => !v)}
            className={`relative flex h-6 w-6 items-center justify-center rounded border transition ${
              showNotifications
                ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
            title="Notifications"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
                {notifications.length > 99 ? "99+" : notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              ref={notifPanelRef}
              className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                <span className="text-xs font-medium text-neutral-300">Notifications</span>
                {notifications.length > 0 && (
                  <button
                    onClick={() => setNotifications([])}
                    className="text-[10px] text-neutral-500 hover:text-neutral-300"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-neutral-500">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n, i) => {
                    const session = sessions.find((s) => s.id === n.sessionId);
                    const timeAgo = (() => {
                      const diff = Date.now() - new Date(n.timestamp).getTime();
                      if (diff < 60000) return "just now";
                      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                      return `${Math.floor(diff / 3600000)}h ago`;
                    })();
                    return (
                      <div
                        key={`${n.sessionId}-${n.timestamp}-${i}`}
                        className="cursor-pointer border-b border-neutral-800/50 px-3 py-2.5 transition hover:bg-neutral-800/50 last:border-b-0"
                        onClick={() => {
                          if (session) {
                            const project = projects.find((p) => p.id === session.projectId);
                            if (project) setSelectedProject(project);
                            setInlineSessionId(session.id);
                          }
                          setShowNotifications(false);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {session && (
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: session.projectColor }}
                                />
                              )}
                              <span className="truncate text-xs font-medium text-neutral-200">{n.title}</span>
                            </div>
                            {n.body && (
                              <div className="mt-0.5 truncate text-[11px] text-neutral-400">{n.body}</div>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] text-neutral-600">{timeAgo}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={layoutSplitRef}
        className="relative flex flex-1 flex-col md:min-h-0 md:flex-row md:overflow-hidden"
      >
        {/* Left Panel — Projects */}
        <div
          className={`flex min-h-[260px] w-full flex-col border-b border-neutral-800 md:min-h-0 md:flex-none md:border-b-0 ${
            isProjectsListCollapsed
              ? "overflow-hidden md:border-r-0"
              : "md:border-r"
          }`}
          style={{
            width: isProjectsListCollapsed ? "0px" : `${leftPanelWidth}px`,
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
                className="flex h-6 w-6 items-center justify-center rounded border border-neutral-700 bg-neutral-900 text-sm font-semibold text-neutral-200 hover:bg-neutral-800"
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
                  onSaved={() => {
                    setAddProjectMode(null);
                    setPrefillSshProfileId(null);
                    setSshFormMode("project");
              
                  }}
                  initialProfileId={prefillSshProfileId}
                  editingProfileId={editingSshProfileId}
                  mode={sshFormMode}
                />
              ) : null}
              {addProjectMode === "docker" ? (
                <AddDockerProjectForm onCreated={handleProjectCreated} />
              ) : null}
            </div>
          ) : null}

          <div className={`flex min-h-0 flex-1 flex-col ${selectedProject ? "" : "overflow-y-auto"}`}>
            {isProjectsListCollapsed ? (
              <div className="px-2 py-4 text-center text-xs tracking-wide text-neutral-500">
                Projects
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-2">
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
                  <div className="flex min-h-0 basis-1/2 flex-col border-b border-neutral-800 px-3 py-2">
                    <div className="mb-2 flex items-center gap-2 text-xs text-neutral-400">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: selectedProject.color }}
                      />
                      {editingProjectName ? (
                        <input
                          autoFocus
                          value={editingProjectNameValue}
                          onChange={(e) => setEditingProjectNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const trimmed = editingProjectNameValue.trim();
                              if (trimmed && trimmed !== selectedProject.name) {
                                handleRenameProject(selectedProject.id, trimmed);
                              }
                              setEditingProjectName(false);
                            } else if (e.key === "Escape") {
                              setEditingProjectName(false);
                            }
                          }}
                          onBlur={() => {
                            const trimmed = editingProjectNameValue.trim();
                            if (trimmed && trimmed !== selectedProject.name) {
                              handleRenameProject(selectedProject.id, trimmed);
                            }
                            setEditingProjectName(false);
                          }}
                          className="min-w-0 flex-1 rounded border border-neutral-600 bg-neutral-800 px-1 py-0.5 text-xs text-neutral-200 outline-none focus:border-border-focus"
                        />
                      ) : (
                        <span
                          className="cursor-pointer truncate hover:text-neutral-200"
                          onDoubleClick={() => {
                            setEditingProjectName(true);
                            setEditingProjectNameValue(selectedProject.name);
                          }}
                          title="Double-click to rename"
                        >
                          {selectedProject.name}
                        </span>
                      )}
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
                      {false && (
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
                      )}
                    </div>

                    {projectFocusTab === "sessions" ? (
                      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded border border-neutral-800 bg-neutral-900/40">
                        <div className="flex items-center gap-1 border-b border-neutral-800 px-2 py-1">
                          <button
                            onClick={() => setSessionViewMode("active")}
                            className={`rounded px-2 py-0.5 text-xs ${
                              sessionViewMode === "active"
                                ? "bg-neutral-700 text-neutral-100"
                                : "text-neutral-500 hover:text-neutral-300"
                            }`}
                          >
                            Active
                          </button>
                          <button
                            onClick={() => setSessionViewMode("all")}
                            className={`rounded px-2 py-0.5 text-xs ${
                              sessionViewMode === "all"
                                ? "bg-neutral-700 text-neutral-100"
                                : "text-neutral-500 hover:text-neutral-300"
                            }`}
                          >
                            All
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5 border-b border-neutral-800 p-2">
                          <input
                            value={projectSessionName}
                            onChange={(e) =>
                              setProjectSessionName(e.target.value)
                            }
                            placeholder="Session name"
                            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-border-focus focus:outline-none"
                          />
                          <div className="flex gap-1.5">
                            <select
                              value={quickSessionAgent}
                              onChange={(e) =>
                                setQuickSessionAgent(
                                  e.target.value as NewSessionAgent,
                                )
                              }
                              className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-border-focus focus:outline-none"
                            >
                              <option value="terminal">Terminal</option>
                              <option value="claude-code">Claude Code</option>
                              <option value="codex">Codex</option>
                              <option value="opencode">OpenCode</option>
                            </select>
                            {quickSessionAgent === "claude-code" && (
                              <button
                                onClick={() => setSkipPermissions((v) => !v)}
                                className={`shrink-0 rounded border px-2 py-1 text-[10px] font-medium transition ${
                                  skipPermissions
                                    ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                                    : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
                                }`}
                                title="dangerously-skip-permissions"
                              >
                                YOLO
                              </button>
                            )}
                            <button
                              onClick={() => {
                                void handleCreateSelectedProjectSession();
                              }}
                              disabled={creatingSession}
                              className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {creatingSession ? "..." : "+ New"}
                            </button>
                          </div>
                        </div>
                        <SessionList
                          sessions={selectedProjectSessions}
                          sessionContexts={sessionContexts}
                          onTerminate={handleTerminateSession}
                          onTerminateAndRestart={handleTerminateAndRestart}
                          onResume={handleResumeSession}
                          onRename={handleRenameSession}
                          onOpenSession={handleOpenSessionFromList}
                        />
                      </div>
                    ) : null}

                    {projectFocusTab === "files" && selectedProject ? (
                      <SidebarFileTree
                        key={selectedProject.id}
                        projectId={selectedProject.id}
                        files={selectedProjectFiles}
                        activePath={viewedFile?.projectId === selectedProject.id ? viewedFile.path : null}
                        initialDir={projectDirMap[selectedProject.id]}
                        onFileOpen={(path, content) =>
                          setViewedFile({ projectId: selectedProject.id, path, content })
                        }
                        onDirChange={(dir) =>
                          setProjectDirMap((prev) => ({ ...prev, [selectedProject.id]: dir }))
                        }
                      />
                    ) : null}


                    {false && projectFocusTab === "harness" ? (
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
                            href={`/graph?projectId=${selectedProject!.id}`}
                            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                          >
                            Manage Skills
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className={`shrink-0 ${selectedProject ? "min-h-0 basis-1/2 overflow-y-auto border-t border-neutral-800" : ""}`}>
                  <ProjectList
                    projects={projects}
                    selectedId={selectedProject?.id ?? null}
                    onSelect={handleSelectProject}
                    onDelete={handleDeleteProject}
                    onRename={handleRenameProject}
                    onUpdateConfig={handleUpdateProjectConfig}
                    onChangeColor={handleChangeProjectColor}
                  />
                </div>
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isProjectsListCollapsed ? (
            <button
              onClick={() => setIsProjectsListCollapsed(false)}
              className="absolute left-0 top-3 z-10 hidden h-8 w-6 items-center justify-center rounded-r border border-l-0 border-neutral-700 bg-neutral-900 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800 md:flex"
              title="Expand projects"
            >
              ▶
            </button>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Workspace — kept mounted (hidden) to preserve tab state */}
            <div className={`flex h-full min-h-0 flex-col overflow-hidden ${
              selectedProject || inlineSessionId ? "" : "hidden"
            }`}>
              <div className="min-h-0 flex-1 overflow-hidden p-0">
                {!inlineSessionId && !viewedFile && (selectedProject || inlineSessionId) ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 text-center text-sm text-neutral-500">
                    Select a session or file from the left panel.
                  </div>
                ) : (
                  <BorderlessWorkspace
                    sessions={sessions}
                    selectedProject={selectedProject}
                    projectPaneMode={projectPaneMode}
                    inlineSessionId={inlineSessionId}
                    inlineWorkspaceId={inlineWorkspaceId}
                    viewedFile={viewedFile}
                    onCloseFile={() => setViewedFile(null)}
                    onKillSession={handleTerminateSession}
                    killedSessionId={killedSessionId}
                    onEmpty={() => {
                      setInlineSessionId(null);
                      setSelectedProject(null);
                    }}
                  />
                )}
              </div>
            </div>
            {/* Home screen */}
            <div className={`space-y-4 overflow-y-auto p-4 ${
              selectedProject || inlineSessionId ? "hidden" : ""
            }`}>
                <CostDashboard />

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
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300 focus:border-border-focus focus:outline-none"
                      />
                      <select
                        value={quickSessionProjectId}
                        onChange={(e) =>
                          setQuickSessionProjectId(e.target.value)
                        }
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300 focus:border-border-focus focus:outline-none"
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
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-300 focus:border-border-focus focus:outline-none"
                      >
                        <option value="terminal">Terminal</option>
                        <option value="claude-code">Claude Code</option>
                        <option value="codex">Codex</option>
                        <option value="opencode">OpenCode</option>
                      </select>
                      {quickSessionAgent === "claude-code" && (
                        <button
                          onClick={() => setSkipPermissions((v) => !v)}
                          className={`rounded border px-2 py-1.5 text-[10px] font-medium transition ${
                            skipPermissions
                              ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                              : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
                          }`}
                          title="dangerously-skip-permissions"
                        >
                          YOLO
                        </button>
                      )}
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

                <SshVaultPanel
                  onQuickConnect={handleVaultQuickConnect}
                  onNewProject={(profileId) => openSshProjectForm(profileId)}
                  onEditProfile={(profileId) => openSshVaultForm(profileId)}
                  onAddProfile={() => openSshVaultForm()}
                />

                <AuditLogPanel
                    activeSessions={activeSessions}
                    onNavigateSession={(sessionId) => {
                      const session = sessions.find((s) => s.id === sessionId);
                      if (session) {
                        const project = projects.find((p) => p.id === session.projectId);
                        if (project) setSelectedProject(project);
                        setInlineSessionId(sessionId);
                      }
                    }}
                  />

              </div>
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
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-border-focus"
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

    </div>
  );
}
