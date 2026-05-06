"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MobileChatTerminal from "@/components/terminal/MobileChatTerminal";
import Button from "@/components/ui/Button";
import { useSocket } from "@/lib/useSocket";
import type {
  ApiError,
  ApiResponse,
  CreateSessionRequest,
  ProjectInfo,
  SessionInfo,
} from "@/lib/types";

const SELECTED_PROJECT_STORAGE_KEY = "orbit:mobile:selected-project";
const ACTIVE_SESSION_STORAGE_KEY = "orbit:mobile:active-session";

type ControlState = "browse" | "chat";
type MobileSessionAgent = "terminal" | "claude-code" | "codex" | "opencode";

const MOBILE_AGENT_OPTIONS: Array<{
  value: MobileSessionAgent;
  label: string;
}> = [
  { value: "terminal", label: "Terminal" },
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "opencode", label: "OpenCode" },
];

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(key, value);
    return;
  }
  window.localStorage.removeItem(key);
}

function isOrbitActiveSession(session: SessionInfo): boolean {
  return session.source !== "claude-history" && session.status === "active";
}

function buildStartRequest(
  projectId: string,
  agentType: MobileSessionAgent,
): CreateSessionRequest {
  return {
    projectId,
    agentType,
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export default function MobileModeScreen() {
  const { socket, connected, backgrounded } = useSocket();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [allSessions, setAllSessions] = useState<SessionInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [boundSessionId, setBoundSessionId] = useState<string | null>(null);
  const [controlState, setControlState] = useState<ControlState>("browse");
  const [mutationState, setMutationState] = useState<
    "idle" | "starting" | "stopping"
  >("idle");
  const [selectedAgent, setSelectedAgent] =
    useState<MobileSessionAgent>("claude-code");
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const activeSessions = useMemo(
    () => allSessions.filter(isOrbitActiveSession),
    [allSessions],
  );

  const selectedProjectActiveSession = useMemo(
    () => sessions.find(isOrbitActiveSession) ?? null,
    [sessions],
  );

  const activeSession = useMemo(() => {
    if (boundSessionId) {
      const bound = activeSessions.find(
        (session) => session.id === boundSessionId,
      );
      if (bound) return bound;
    }
    return selectedProjectActiveSession;
  }, [activeSessions, boundSessionId, selectedProjectActiveSession]);

  const isOffline = !online;
  const isBusy = mutationState !== "idle";

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects");
      const json = (await res.json()) as ApiResponse<ProjectInfo[]> | ApiError;
      if (!res.ok || !("data" in json)) {
        throw new Error(
          "error" in json ? json.error : "Failed to load projects",
        );
      }

      setProjects(dedupeById(json.data));

      setSelectedProjectId((prev) => {
        const stored = prev ?? readStorage(SELECTED_PROJECT_STORAGE_KEY);
        const preferred =
          stored && json.data.some((project) => project.id === stored)
            ? stored
            : (json.data[0]?.id ?? null);
        writeStorage(SELECTED_PROJECT_STORAGE_KEY, preferred);
        return preferred;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async (projectId: string) => {
    setSessionsLoading(true);

    try {
      const res = await fetch(
        `/api/sessions?projectId=${encodeURIComponent(projectId)}`,
      );
      const json = (await res.json()) as ApiResponse<SessionInfo[]> | ApiError;
      if (!res.ok || !("data" in json)) {
        throw new Error(
          "error" in json ? json.error : "Failed to load sessions",
        );
      }

      setSessions(dedupeById(json.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const fetchAllSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const json = (await res.json()) as ApiResponse<SessionInfo[]> | ApiError;
      if (!res.ok || !("data" in json)) {
        throw new Error(
          "error" in json ? json.error : "Failed to load all sessions",
        );
      }

      const nextSessions = dedupeById(json.data);
      setAllSessions(nextSessions);
      setBoundSessionId((prev) => {
        const stored = prev ?? readStorage(ACTIVE_SESSION_STORAGE_KEY);
        const next =
          stored &&
          nextSessions.some(
            (session) => session.id === stored && isOrbitActiveSession(session),
          )
            ? stored
            : null;
        writeStorage(ACTIVE_SESSION_STORAGE_KEY, next);
        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load all sessions",
      );
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
    void fetchAllSessions();
  }, [fetchAllSessions, fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSessions([]);
      return;
    }

    writeStorage(SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
    void fetchSessions(selectedProjectId);
    void fetchAllSessions();
  }, [fetchAllSessions, fetchSessions, selectedProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncOnline = () => setOnline(window.navigator.onLine);
    syncOnline();

    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    if (activeSession && controlState !== "chat") {
      return;
    }
    if (!activeSession && controlState === "chat" && !boundSessionId) {
      setControlState("browse");
    }
  }, [activeSession, boundSessionId, controlState]);

  const handleSelectProject = useCallback((projectId: string) => {
    setError(null);
    setSelectedProjectId(projectId);
    setControlState("browse");
  }, []);

  const handleStart = useCallback(async () => {
    if (!selectedProjectId || isBusy || isOffline) return;
    if (activeSession) {
      setControlState("chat");
      return;
    }

    setMutationState("starting");
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildStartRequest(selectedProjectId, selectedAgent),
        ),
      });
      const json = (await res.json()) as ApiResponse<SessionInfo> | ApiError;
      if (!res.ok || !("data" in json)) {
        throw new Error(
          "error" in json ? json.error : "Failed to start session",
        );
      }

      setBoundSessionId(json.data.id);
      writeStorage(ACTIVE_SESSION_STORAGE_KEY, json.data.id);
      setControlState("chat");
      await fetchAllSessions();
      await fetchSessions(selectedProjectId);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setMutationState("idle");
    }
  }, [
    activeSession,
    fetchAllSessions,
    fetchProjects,
    fetchSessions,
    isBusy,
    isOffline,
    selectedAgent,
    selectedProjectId,
  ]);

  const handleStop = useCallback(async () => {
    if (!activeSession || isBusy || isOffline) return;

    setMutationState("stopping");
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${activeSession.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as
        | ApiResponse<{ terminated: boolean }>
        | ApiError;
      if (!res.ok || (!("data" in json) && !("error" in json))) {
        throw new Error(
          "error" in json ? json.error : "Failed to stop session",
        );
      }

      setBoundSessionId(null);
      writeStorage(ACTIVE_SESSION_STORAGE_KEY, null);
      setControlState("browse");
      await fetchAllSessions();
      if (selectedProjectId) {
        await fetchSessions(selectedProjectId);
      }
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop session");
    } finally {
      setMutationState("idle");
    }
  }, [
    activeSession,
    fetchAllSessions,
    fetchProjects,
    fetchSessions,
    isBusy,
    isOffline,
    selectedProjectId,
  ]);

  const handleReenter = useCallback(() => {
    if (!activeSession) return;
    setBoundSessionId(activeSession.id);
    writeStorage(ACTIVE_SESSION_STORAGE_KEY, activeSession.id);
    setControlState("chat");
  }, [activeSession]);

  const handleChatExit = useCallback(() => {
    setControlState("browse");
    if (selectedProjectId) {
      void fetchSessions(selectedProjectId);
    }
    void fetchProjects();
  }, [fetchProjects, fetchSessions, selectedProjectId]);

  return (
    <main
      className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col bg-neutral-950 text-neutral-100"
      data-testid="mobile-route-shell"
    >
      <div className="border-b border-neutral-800 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Mobile Orbit
            </p>
            <h1 className="mt-1 text-xl font-semibold">Project sessions</h1>
          </div>
          <div
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              isOffline
                ? "bg-red-500/10 text-red-300"
                : backgrounded || !connected
                  ? "bg-amber-500/10 text-amber-200"
                  : "bg-emerald-500/10 text-emerald-200"
            }`}
            data-testid="mobile-network-state"
          >
            {isOffline
              ? "Offline"
              : backgrounded || !connected
                ? "Reconnecting"
                : "Online"}
          </div>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Start one session at a time, chat with it, and stop it when you’re
          done.
        </p>
      </div>

      {error ? (
        <div
          className="mx-4 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          data-testid="mobile-error"
        >
          {error}
        </div>
      ) : null}

      {controlState === "chat" && (activeSession || boundSessionId) ? (
        <div
          className="flex min-h-0 flex-1 flex-col"
          data-testid="mobile-chat-shell"
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-100">
                {selectedProject?.name ??
                  activeSession?.projectName ??
                  "Session"}
              </div>
              <div className="truncate text-xs text-neutral-500">
                {activeSession
                  ? (activeSession.name ?? `${activeSession.agentType} session`)
                  : "Preparing your mobile session…"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChatExit}
                data-testid="mobile-back-button"
              >
                Back
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleStop()}
                disabled={isBusy || isOffline || !activeSession}
                data-testid="mobile-stop-button"
              >
                {mutationState === "stopping" ? "Stopping…" : "Stop"}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {activeSession && socket ? (
              <MobileChatTerminal
                sessionId={activeSession.id}
                socket={socket}
                connected={connected}
                yoloMode={false}
                onExit={handleChatExit}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-sm text-neutral-500">
                Preparing the session…
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
          <div className="mb-4" data-testid="mobile-project-list">
            <h2 className="mb-2 text-sm font-medium text-neutral-300">
              Projects
            </h2>
            <div className="space-y-2">
              {projectsLoading ? (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-500">
                  Loading projects…
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-500">
                  No projects available yet.
                </div>
              ) : (
                projects.map((project) => {
                  const isSelected = project.id === selectedProjectId;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleSelectProject(project.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-orbit-accent-primary bg-neutral-900"
                          : "border-neutral-800 bg-neutral-900/60"
                      }`}
                      data-testid={`mobile-project-card-${project.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-neutral-100">
                            {project.name}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {project.sessionCount} active session
                            {project.sessionCount === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <section
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-4"
            data-testid="mobile-session-controls"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-neutral-200">
                  Session
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {selectedProject
                    ? boundSessionId &&
                      activeSession &&
                      activeSession.projectId !== selectedProject.id
                      ? `A session is already active in ${activeSession.projectName}. Re-enter or stop it before starting another.`
                      : `Use ${selectedProject.name} as the current mobile workspace.`
                    : "Select a project to start chatting."}
                </p>
              </div>
              <div className="rounded-full bg-neutral-800 px-2.5 py-1 text-[11px] text-neutral-400">
                {sessionsLoading
                  ? "Loading"
                  : activeSession
                    ? activeSession.status === "active"
                      ? "Active"
                      : activeSession.status
                    : "Idle"}
              </div>
            </div>

            {selectedProject ? (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
                <div className="text-sm font-medium text-neutral-100">
                  {selectedProject.name}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {activeSession
                    ? `${activeSession.name ?? activeSession.agentType} is ready in ${activeSession.projectName}.`
                    : "No active mobile session yet."}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <label
                htmlFor="mobile-agent-select"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
              >
                Session agent
              </label>
              <select
                id="mobile-agent-select"
                value={selectedAgent}
                onChange={(e) =>
                  setSelectedAgent(e.target.value as MobileSessionAgent)
                }
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-neutral-200 focus:border-border-focus focus:outline-none"
                data-testid="mobile-agent-select"
              >
                {MOBILE_AGENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <Button
                size="lg"
                onClick={() => void handleStart()}
                disabled={!selectedProject || isBusy || isOffline}
                data-testid="mobile-start-button"
              >
                {mutationState === "starting"
                  ? "Starting…"
                  : activeSession
                    ? `Re-enter current ${activeSession.agentType} session`
                    : `Start ${MOBILE_AGENT_OPTIONS.find((option) => option.value === selectedAgent)?.label ?? "session"}`}
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleReenter}
                  disabled={!activeSession || isBusy}
                  data-testid="mobile-reenter-button"
                >
                  Re-enter
                </Button>
                <Button
                  variant="danger"
                  size="lg"
                  onClick={() => void handleStop()}
                  disabled={!activeSession || isBusy || isOffline}
                  data-testid="mobile-stop-button"
                >
                  {mutationState === "stopping" ? "Stopping…" : "Stop"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
