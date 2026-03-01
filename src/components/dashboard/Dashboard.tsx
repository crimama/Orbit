"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ProjectList from "./ProjectList";
import SessionList from "./SessionList";
import AddProjectForm from "./AddProjectForm";
import AddSshProjectForm from "./AddSshProjectForm";
import AddDockerProjectForm from "./AddDockerProjectForm";
import InterceptorBanner from "./InterceptorBanner";
import InterceptorModal from "./InterceptorModal";
import ProjectHarnessPanel from "./ProjectHarnessPanel";
import MultiTerminal from "@/components/terminal/MultiTerminal";
import ProjectFilesPanel from "@/components/files/ProjectFilesPanel";
import { usePendingApprovals } from "@/lib/hooks/usePendingApprovals";
import type {
  ProjectInfo,
  SessionInfo,
  ProjectAgentInfo,
  SshConfigInfo,
  WorkspaceLayoutInfo,
  GraphState,
  ApiResponse,
  CreateSessionRequest,
} from "@/lib/types";

type AddProjectMode = null | "local" | "ssh" | "docker";
type NewSessionAgent = "terminal" | "claude-code" | "codex" | "opencode";
type LeftPanelMode = "projects" | "vaults" | "sessions";
type SessionViewMode = "active" | "all";
type ProjectPaneMode = "terminal" | "files" | "harness";

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(
    null,
  );
  const [addProjectMode, setAddProjectMode] = useState<AddProjectMode>(null);
  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>("sessions");
  const [isProjectsListCollapsed, setIsProjectsListCollapsed] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionViewMode, setSessionViewMode] =
    useState<SessionViewMode>("all");
  const [, setShowHarnessManager] = useState(false);
  const [projectPaneMode, setProjectPaneMode] =
    useState<ProjectPaneMode>("terminal");
  const [inlineSessionId, setInlineSessionId] = useState<string | null>(null);
  const [inlineWorkspaceId, setInlineWorkspaceId] = useState<string | null>(
    null,
  );
  const [newSessionAgent, setNewSessionAgent] =
    useState<NewSessionAgent>("claude-code");
  const [quickSessionProjectId, setQuickSessionProjectId] = useState("");
  const [showSessionQuickCreate, setShowSessionQuickCreate] = useState(false);
  const [projectAgents, setProjectAgents] = useState<ProjectAgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [skillCount, setSkillCount] = useState(0);
  const [sshConfigs, setSshConfigs] = useState<SshConfigInfo[]>([]);
  const [globalWorkspaces, setGlobalWorkspaces] = useState<
    WorkspaceLayoutInfo[]
  >([]);
  const [prefillSshProfileId, setPrefillSshProfileId] = useState<string | null>(
    null,
  );
  const [showInterceptorModal, setShowInterceptorModal] = useState(false);
  const { pendingApprovals, approve, deny, latestApproval } =
    usePendingApprovals();

  const uniqueSshConfigs = useMemo(() => {
    const seen = new Set<string>();
    const list: SshConfigInfo[] = [];
    for (const cfg of sshConfigs) {
      const key = [
        cfg.host,
        String(cfg.port),
        cfg.username,
        cfg.authMethod,
        cfg.keyPath ?? "",
        cfg.proxyConfigId ?? "",
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(cfg);
    }
    return list;
  }, [sshConfigs]);

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

  const fetchSshConfigs = useCallback(async () => {
    const res = await fetch("/api/ssh-configs");
    const json = (await res.json()) as ApiResponse<SshConfigInfo[]>;
    if ("data" in json) setSshConfigs(json.data);
  }, []);

  const fetchGlobalWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    const json = (await res.json()) as ApiResponse<WorkspaceLayoutInfo[]>;
    if ("data" in json) setGlobalWorkspaces(json.data);
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchSessions();
    fetchSshConfigs();
    fetchGlobalWorkspaces();
  }, [fetchProjects, fetchSessions, fetchSshConfigs, fetchGlobalWorkspaces]);

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
      setShowHarnessManager(true);
      setProjectPaneMode("harness");
      setInlineSessionId(null);
      setInlineWorkspaceId(null);
      fetchSessions();
    },
    [fetchSessions],
  );

  const fetchProjectAgents = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/project-agents?projectId=${projectId}`);
    const json = (await res.json()) as ApiResponse<ProjectAgentInfo[]>;
    if ("data" in json) {
      setProjectAgents(json.data);
      if (json.data.length > 0) {
        setSelectedAgentId((prev) =>
          prev && json.data.some((a) => a.id === prev) ? prev : json.data[0].id,
        );
      } else {
        setSelectedAgentId("");
      }
    }
  }, []);

  const fetchSkillCount = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/skills?projectId=${projectId}`);
    const json = (await res.json()) as ApiResponse<GraphState>;
    if ("data" in json) {
      setSkillCount(json.data.nodes.length);
    }
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setProjectAgents([]);
      setSelectedAgentId("");
      setSkillCount(0);
      return;
    }
    void fetchProjectAgents(selectedProject.id);
    void fetchSkillCount(selectedProject.id);
  }, [selectedProject, fetchProjectAgents, fetchSkillCount]);

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
    async (request: CreateSessionRequest) => {
      setCreatingSession(true);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const json = (await res.json()) as ApiResponse<SessionInfo>;
        if ("data" in json) {
          setInlineSessionId(json.data.id);
          setInlineWorkspaceId(null);
          fetchSessions();
        }
      } finally {
        setCreatingSession(false);
      }
    },
    [fetchSessions],
  );

  const handleCreateSession = useCallback(async () => {
    if (!selectedProject) return;
    const selectedAgent = projectAgents.find((a) => a.id === selectedAgentId);
    await createSession({
      projectId: selectedProject!.id,
      agentType: selectedAgent?.agentType ?? newSessionAgent,
      name: selectedAgent?.name,
    });
  }, [
    createSession,
    selectedProject,
    newSessionAgent,
    projectAgents,
    selectedAgentId,
  ]);

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
    setShowHarnessManager(false);
    setProjectPaneMode("terminal");

    await createSession({
      projectId,
      agentType: newSessionAgent,
    });
  }, [quickSessionProjectId, projects, createSession, newSessionAgent]);

  const handleProjectCreated = useCallback(
    (project: ProjectInfo) => {
      setProjects((prev) => [project, ...prev]);
      setAddProjectMode(null);
      setPrefillSshProfileId(null);
      handleSelectProject(project);
      void fetchSshConfigs();
    },
    [handleSelectProject, fetchSshConfigs],
  );

  const handleGoHome = useCallback(() => {
    setSelectedProject(null);
    setLeftPanelMode("sessions");
    setIsProjectsListCollapsed(false);
    setAddProjectMode(null);
    setPrefillSshProfileId(null);
    setShowSessionQuickCreate(false);
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

  useEffect(() => {
    if (!selectedProject) return;
    if (!inlineSessionId) {
      setInlineSessionId(activeSessions[0]?.id ?? null);
      return;
    }
  }, [selectedProject, inlineSessionId, activeSessions]);

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
      setShowHarnessManager(false);
      setProjectPaneMode("terminal");
      setInlineSessionId(sessionId);
      setInlineWorkspaceId(null);
    },
    [sessions, projects],
  );

  const handleDeleteSshVault = useCallback(
    async (id: string) => {
      await fetch(`/api/ssh-configs/${id}`, { method: "DELETE" });
      fetchSshConfigs();
    },
    [fetchSshConfigs],
  );

  const openSessionInDashboard = useCallback(
    (session: SessionInfo) => {
      const project = projects.find((p) => p.id === session.projectId);
      if (project) {
        setSelectedProject(project);
      }

      setSessionViewMode("active");
      setShowHarnessManager(false);
      setProjectPaneMode("terminal");
      setInlineSessionId(session.id);
      setInlineWorkspaceId(null);
      void fetchSessions();
    },
    [projects, fetchSessions],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-y-auto bg-[#0a0a0a] text-neutral-200 md:h-[100dvh] md:overflow-hidden">
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

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row md:overflow-hidden">
        {/* Left Panel — Projects */}
        <div
          className={`flex min-h-[260px] w-full flex-col border-b border-neutral-800 md:min-h-0 md:border-b-0 md:border-r ${
            isProjectsListCollapsed ? "md:w-20" : "md:w-72"
          }`}
        >
          <div
            className={`flex min-w-0 items-center gap-2 border-b border-neutral-800 py-3 ${
              isProjectsListCollapsed
                ? "justify-center px-2"
                : "justify-between px-4"
            }`}
          >
            {!isProjectsListCollapsed && (
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-1">
                <button
                  onClick={() => {
                    setLeftPanelMode("projects");
                    setPrefillSshProfileId(null);
                    setAddProjectMode(null);
                    setShowSessionQuickCreate(false);
                    setSelectedProject(null);
                    setInlineSessionId(null);
                    setInlineWorkspaceId(null);
                    setSessionViewMode("all");
                    setShowHarnessManager(false);
                    setProjectPaneMode("terminal");
                  }}
                  className={`shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                    leftPanelMode === "projects"
                      ? "bg-neutral-800 text-neutral-200"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  }`}
                >
                  Projects
                </button>
                <button
                  onClick={() => {
                    setLeftPanelMode("vaults");
                    setSelectedProject(null);
                    setAddProjectMode(null);
                    setShowSessionQuickCreate(false);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                    leftPanelMode === "vaults"
                      ? "bg-neutral-800 text-neutral-200"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  }`}
                >
                  Vaults
                </button>
                <button
                  onClick={() => {
                    setLeftPanelMode("sessions");
                    setAddProjectMode(null);
                    setShowSessionQuickCreate(false);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                    leftPanelMode === "sessions"
                      ? "bg-neutral-800 text-neutral-200"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  }`}
                >
                  Sessions
                </button>
              </div>
            )}
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

          {!isProjectsListCollapsed &&
            leftPanelMode === "projects" &&
            addProjectMode !== null && (
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
                {addProjectMode === "local" && (
                  <AddProjectForm onCreated={handleProjectCreated} />
                )}
                {addProjectMode === "ssh" && (
                  <AddSshProjectForm
                    onCreated={handleProjectCreated}
                    initialProfileId={prefillSshProfileId}
                  />
                )}
                {addProjectMode === "docker" && (
                  <AddDockerProjectForm onCreated={handleProjectCreated} />
                )}
              </div>
            )}

          {!isProjectsListCollapsed &&
            leftPanelMode === "vaults" &&
            addProjectMode === "ssh" && (
              <div className="max-h-[55vh] overflow-y-auto border-b border-neutral-800">
                <AddSshProjectForm
                  mode="vault"
                  initialProfileId={prefillSshProfileId}
                  editingProfileId={prefillSshProfileId}
                  onSaved={() => {
                    setAddProjectMode(null);
                    setPrefillSshProfileId(null);
                    void fetchSshConfigs();
                  }}
                />
              </div>
            )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isProjectsListCollapsed ? (
              <div className="px-2 py-4 text-center text-xs tracking-wide text-neutral-500">
                Projects
              </div>
            ) : leftPanelMode === "projects" ? (
              <>
                <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                  <span className="text-xs text-neutral-500">Projects</span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => {
                        setLeftPanelMode("vaults");
                        setAddProjectMode(null);
                        setSelectedProject(null);
                      }}
                      className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      Vaults
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
            ) : leftPanelMode === "sessions" ? (
              <>
                <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                  <span className="text-xs text-neutral-500">Sessions</span>
                  <div className="flex items-center gap-1">
                    <div className="inline-flex rounded border border-neutral-700 bg-neutral-900 p-0.5 text-xs">
                      <button
                        onClick={() => setSessionViewMode("active")}
                        className={`rounded px-2 py-1 ${
                          sessionViewMode === "active"
                            ? "bg-neutral-700 text-neutral-100"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => setSessionViewMode("all")}
                        className={`rounded px-2 py-1 ${
                          sessionViewMode === "all"
                            ? "bg-neutral-700 text-neutral-100"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        All
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setShowSessionQuickCreate((prev) => !prev);
                      }}
                      disabled={projects.length === 0}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {showSessionQuickCreate ? "Cancel" : "+ New"}
                    </button>
                  </div>
                </div>
                {showSessionQuickCreate ? (
                  <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
                    <select
                      value={quickSessionProjectId}
                      onChange={(e) => setQuickSessionProjectId(e.target.value)}
                      className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        void handleQuickCreateSession();
                        setShowSessionQuickCreate(false);
                      }}
                      disabled={creatingSession || projects.length === 0}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingSession ? "Creating..." : "Create"}
                    </button>
                  </div>
                ) : null}
                <SessionList
                  sessions={visibleSessions}
                  onTerminate={handleTerminateSession}
                  onResume={handleResumeClaudeSession}
                  onRename={handleRenameSession}
                  onOpenSession={handleOpenSessionFromList}
                />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                  <span className="text-xs text-neutral-500">Vaults</span>
                  <button
                    onClick={() => {
                      setLeftPanelMode("vaults");
                      setPrefillSshProfileId(null);
                      setAddProjectMode(
                        addProjectMode === "ssh" ? null : "ssh",
                      );
                    }}
                    className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  >
                    {addProjectMode === "ssh" ? "Cancel" : "+ SSH"}
                  </button>
                </div>
                <div className="space-y-1 p-2">
                  {uniqueSshConfigs.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-neutral-500">
                      No SSH hosts in vault.
                    </div>
                  ) : null}
                  {uniqueSshConfigs.map((cfg) => (
                    <div
                      key={cfg.id}
                      className="rounded-lg px-3 py-2 text-neutral-300 hover:bg-neutral-800/50"
                    >
                      <div className="truncate text-sm font-medium">
                        {cfg.label?.trim() ||
                          `${cfg.username}@${cfg.host}:${cfg.port}`}
                      </div>
                      <div className="truncate text-xs text-neutral-500">
                        {cfg.username}@{cfg.host}:{cfg.port}
                      </div>
                      {cfg.tags && (
                        <div className="truncate text-xs text-neutral-600">
                          {cfg.tags}
                        </div>
                      )}
                      <div className="mt-1 flex gap-1">
                        <button
                          onClick={() => {
                            setPrefillSshProfileId(cfg.id);
                            setLeftPanelMode("projects");
                            setAddProjectMode("ssh");
                          }}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => {
                            setPrefillSshProfileId(cfg.id);
                            setLeftPanelMode("vaults");
                            setAddProjectMode("ssh");
                          }}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSshVault(cfg.id)}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-500 hover:border-red-900 hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Panel — Sessions */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-3 sm:px-4">
            <h2 className="text-sm font-semibold">
              {selectedProject ? "Sessions" : "Dashboard Home"}
              {selectedProject && (
                <span className="ml-2 inline-flex max-w-[75vw] items-center gap-2 truncate font-normal text-neutral-500 sm:max-w-none">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: selectedProject.color }}
                  />
                  {selectedProject.name}
                </span>
              )}
            </h2>
            {selectedProject && (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {projectAgents.length > 0 ? (
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none sm:min-w-[180px] sm:flex-none"
                  >
                    {projectAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.agentType})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={newSessionAgent}
                    onChange={(e) =>
                      setNewSessionAgent(e.target.value as NewSessionAgent)
                    }
                    className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none sm:min-w-[180px] sm:flex-none"
                  >
                    <option value="terminal">Terminal</option>
                    <option value="claude-code">Claude Code</option>
                    <option value="codex">Codex</option>
                    <option value="opencode">OpenCode</option>
                  </select>
                )}
                <button
                  onClick={handleCreateSession}
                  disabled={creatingSession}
                  className="w-full rounded bg-neutral-700 px-3 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50 sm:w-auto"
                >
                  {creatingSession ? "Creating..." : "+ New Session"}
                </button>
                <div className="inline-flex w-full rounded border border-neutral-700 bg-neutral-900 p-0.5 text-xs sm:w-auto">
                  <button
                    onClick={() => {
                      setProjectPaneMode("terminal");
                      setShowHarnessManager(false);
                    }}
                    className={`rounded px-2 py-1 ${
                      projectPaneMode === "terminal"
                        ? "bg-neutral-700 text-neutral-100"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Terminal
                  </button>
                  <button
                    onClick={() => {
                      setProjectPaneMode("files");
                      setShowHarnessManager(false);
                    }}
                    className={`rounded px-2 py-1 ${
                      projectPaneMode === "files"
                        ? "bg-neutral-700 text-neutral-100"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Files
                  </button>
                  <button
                    onClick={() => {
                      setProjectPaneMode("harness");
                      setShowHarnessManager(true);
                    }}
                    className={`rounded px-2 py-1 ${
                      projectPaneMode === "harness"
                        ? "bg-cyan-700/60 text-cyan-100"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Harness
                  </button>
                </div>
              </div>
            )}
          </div>

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
                    <ProjectHarnessPanel projectId={selectedProject.id} />
                  </div>
                )}

                <div className="min-h-0 flex-1 p-2 sm:p-3">
                  {projectPaneMode === "files" ? (
                    <ProjectFilesPanel projectId={selectedProject.id} />
                  ) : inlineSessionId ? (
                    <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
                      <MultiTerminal
                        key={`${inlineSessionId}:${inlineWorkspaceId ?? "none"}`}
                        initialSessionId={inlineSessionId}
                        initialWorkspaceId={inlineWorkspaceId}
                        autoRestoreWorkspace={Boolean(inlineWorkspaceId)}
                        onKillSession={handleTerminateSession}
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-500">
                      Active session을 선택하면 이 영역에서 바로 실행됩니다.
                    </div>
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
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
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
                        value={newSessionAgent}
                        onChange={(e) =>
                          setNewSessionAgent(e.target.value as NewSessionAgent)
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
    </div>
  );
}
