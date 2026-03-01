import { prisma } from "@/lib/prisma";
import { shellQuote } from "@/lib/shellQuote";
import { ptyManager } from "@/server/pty/ptyManager";
import { remotePtyManager } from "@/server/ssh/remotePty";
import { sshManager } from "@/server/ssh/sshManager";
import { scanRemoteSessions } from "@/server/ssh/remoteScanner";
import { GC_IDLE_MS, GC_INTERVAL_MS } from "@/lib/constants";
import { sessionMetricsManager } from "@/server/observability/sessionMetrics";
import type { SessionInfo, CreateSessionRequest } from "@/lib/types";

const AGENT_TYPES = {
  TERMINAL: "terminal",
  CODEX: "codex",
  OPENCODE: "opencode",
} as const;

function dockerInnerCommand(
  workdir: string,
  agentType: string,
  resumeSessionRef?: string,
): string {
  const qPath = shellQuote(workdir);
  if (agentType === AGENT_TYPES.TERMINAL) {
    return `cd ${qPath} 2>/dev/null || cd /; exec /bin/bash -il`;
  }
  if (agentType === AGENT_TYPES.CODEX) {
    return `cd ${qPath} 2>/dev/null || cd /; if command -v codex >/dev/null 2>&1; then exec codex; else echo "[Agent Orbit] codex not found in container PATH."; exec /bin/bash -il; fi`;
  }
  if (agentType === AGENT_TYPES.OPENCODE) {
    return `cd ${qPath} 2>/dev/null || cd /; if command -v opencode >/dev/null 2>&1; then exec opencode; else echo "[Agent Orbit] opencode not found in container PATH."; exec /bin/bash -il; fi`;
  }
  const resumeArgs = resumeSessionRef?.trim()
    ? ` --resume ${shellQuote(resumeSessionRef.trim())} --fork-session`
    : "";
  const claudeCmd =
    `if command -v claude >/dev/null 2>&1; then exec claude${resumeArgs}; ` +
    `elif command -v claude-code >/dev/null 2>&1; then exec claude-code${resumeArgs}; ` +
    `else echo "[Agent Orbit] claude/claude-code not found in container PATH."; exec /bin/sh; fi`;
  return `cd ${qPath} 2>/dev/null || cd /; ${claudeCmd}`;
}

function toSessionInfo(row: {
  id: string;
  projectId: string;
  name: string | null;
  agentType: string;
  sessionRef: string;
  status: string;
  lastContext: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: { name: string; color: string };
}): SessionInfo {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    projectColor: row.project.color,
    name: row.name,
    agentType: row.agentType,
    sessionRef: row.sessionRef,
    status: row.status as SessionInfo["status"],
    lastContext: row.lastContext,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    source: "orbit",
  };
}

class SessionManager {
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private bootstrapTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private registerExitHandler(
    sessionId: string,
    backend: "local" | "remote" = "local",
  ): void {
    const manager = backend === "remote" ? remotePtyManager : ptyManager;
    manager.onExit(sessionId, async () => {
      try {
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { status: "terminated" },
        });
      } catch {
        // Session may already be deleted
      }
    });
  }

  private async startRemotePty(
    sessionId: string,
    sshConfigId: string,
    agentType: string,
    resumeSessionRef: string | undefined,
    remoteProject: { path: string; dockerContainer: string | null },
    options?: { cols?: number; rows?: number },
  ): Promise<void> {
    const status = sshManager.getStatus(sshConfigId);
    if (status.state !== "connected") {
      await sshManager.connect(sshConfigId);
    }

    await remotePtyManager.create(sessionId, {
      ...(options?.cols !== undefined && { cols: options.cols }),
      ...(options?.rows !== undefined && { rows: options.rows }),
      sshConfigId,
    });

    this.bootstrapRemoteAgent(
      sessionId,
      { agentType, resumeSessionRef },
      remoteProject,
    );
    this.registerExitHandler(sessionId, "remote");
  }

  async reconcileOnStartup(): Promise<void> {
    const activeCount = await prisma.agentSession.count({
      where: { status: "active" },
    });

    if (activeCount > 0) {
      console.log(
        `[SessionManager] Startup detected ${activeCount} active session(s); keeping status for lazy recovery`,
      );
    }
  }

  async createSession(req: CreateSessionRequest): Promise<SessionInfo> {
    const project = await prisma.project.findUnique({
      where: { id: req.projectId },
    });
    if (!project) {
      throw new Error(`Project not found: ${req.projectId}`);
    }

    const isRemote =
      (project.type === "SSH" || project.type === "DOCKER") &&
      !!project.sshConfigId;
    const isDocker = project.type === "DOCKER";

    const session = await prisma.agentSession.create({
      data: {
        projectId: req.projectId,
        name: req.name ?? null,
        agentType: req.agentType,
        sessionRef: "",
        status: "active",
      },
      include: { project: { select: { name: true, color: true } } },
    });

    try {
      const nextSessionRef = req.resumeSessionRef?.trim() || session.id;

      if (isRemote) {
        if (project.type === "DOCKER" && !project.dockerContainer) {
          throw new Error("dockerContainer is not configured for this project");
        }
        await this.startRemotePty(
          session.id,
          project.sshConfigId!,
          req.agentType,
          req.resumeSessionRef,
          {
            path: project.path,
            dockerContainer: project.dockerContainer,
          },
          { cols: req.cols, rows: req.rows },
        );
      } else {
        if (isDocker && !project.dockerContainer) {
          throw new Error("dockerContainer is not configured for this project");
        }
        ptyManager.create(
          session.id,
          this.getPtyOptionsForCreate(req, {
            type: project.type,
            path: project.path,
            dockerContainer: project.dockerContainer,
          }),
        );
        this.registerExitHandler(session.id, "local");
      }

      // Set sessionRef. For resumed Claude sessions, keep the Claude session ref.
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { sessionRef: nextSessionRef },
      });
    } catch (err) {
      // Rollback: delete the DB record if PTY creation fails
      await prisma.agentSession.delete({ where: { id: session.id } });
      throw err;
    }

    return toSessionInfo({
      ...session,
      sessionRef: req.resumeSessionRef?.trim() || session.id,
    });
  }

  async terminateSession(sessionId: string): Promise<void> {
    const pendingTimer = this.bootstrapTimers.get(sessionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.bootstrapTimers.delete(sessionId);
    }
    sessionMetricsManager.clear(sessionId);
    if (remotePtyManager.has(sessionId)) {
      remotePtyManager.destroy(sessionId);
    } else {
      ptyManager.destroy(sessionId);
    }
    try {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: "terminated" },
      });
    } catch {
      // Session may not exist in DB
    }
  }

  async sendInput(sessionId: string, input: string): Promise<void> {
    const running = await this.ensureSessionRunning(sessionId);
    if (!running) {
      throw new Error("Session is not active");
    }

    if (remotePtyManager.has(sessionId)) {
      remotePtyManager.write(sessionId, input);
      return;
    }

    if (ptyManager.has(sessionId)) {
      ptyManager.write(sessionId, input);
      return;
    }

    throw new Error("Session backend is unavailable");
  }

  async getSession(id: string): Promise<SessionInfo | null> {
    const row = await prisma.agentSession.findUnique({
      where: { id },
      include: { project: { select: { name: true, color: true } } },
    });
    return row ? toSessionInfo(row) : null;
  }

  async listSessions(projectId?: string): Promise<SessionInfo[]> {
    const where = projectId ? { projectId } : {};
    const rows = await prisma.agentSession.findMany({
      where,
      include: { project: { select: { name: true, color: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toSessionInfo);
  }

  async ensureSessionRunning(sessionId: string): Promise<boolean> {
    if (ptyManager.has(sessionId) || remotePtyManager.has(sessionId))
      return true;

    const row = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: {
        project: {
          select: {
            path: true,
            type: true,
            sshConfigId: true,
            dockerContainer: true,
          },
        },
      },
    });

    if (!row) return false;
    if (row.status !== "active") return false;

    // Guard: Docker must be configured if requested
    if (row.project.type === "DOCKER" && !row.project.dockerContainer) {
      return false;
    }

    const isRemote =
      (row.project.type === "SSH" || row.project.type === "DOCKER") &&
      !!row.project.sshConfigId;

    try {
      if (isRemote) {
        await this.startRemotePty(
          sessionId,
          row.project.sshConfigId!,
          row.agentType,
          row.sessionRef !== sessionId ? row.sessionRef : undefined,
          {
            path: row.project.path,
            dockerContainer: row.project.dockerContainer,
          },
        );
      } else {
        ptyManager.create(
          sessionId,
          this.getPtyOptionsForRecover(
            row.agentType,
            row.sessionRef,
            sessionId,
            {
              type: row.project.type,
              path: row.project.path,
              dockerContainer: row.project.dockerContainer,
            },
          ),
        );
        this.registerExitHandler(sessionId, "local");
      }
      return true;
    } catch {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: "terminated" },
      });
      return false;
    }
  }

  private getPtyOptionsForCreate(
    req: CreateSessionRequest,
    project: { type: string; path: string; dockerContainer: string | null },
  ) {
    if (project.type === "DOCKER") {
      const resumeRef = req.resumeSessionRef?.trim();
      return {
        cols: req.cols,
        rows: req.rows,
        cwd: process.env.HOME ?? "/",
        command: "docker",
        args: this.getDockerExecArgs(
          project.dockerContainer!,
          project.path,
          req.agentType,
          resumeRef,
        ),
      };
    }

    if (req.agentType === AGENT_TYPES.TERMINAL) {
      return {
        cols: req.cols,
        rows: req.rows,
        cwd: project.path,
      };
    }

    if (req.agentType === AGENT_TYPES.CODEX) {
      return {
        cols: req.cols,
        rows: req.rows,
        cwd: project.path,
        command: "codex",
        args: [],
      };
    }

    if (req.agentType === AGENT_TYPES.OPENCODE) {
      return {
        cols: req.cols,
        rows: req.rows,
        cwd: project.path,
        command: "opencode",
        args: [],
      };
    }

    const resumeRef = req.resumeSessionRef?.trim();
    return {
      cols: req.cols,
      rows: req.rows,
      cwd: project.path,
      command: "claude",
      args: resumeRef ? ["--resume", resumeRef, "--fork-session"] : [],
    };
  }

  private getPtyOptionsForRecover(
    agentType: string,
    sessionRef: string,
    dbSessionId: string,
    project: { type: string; path: string; dockerContainer: string | null },
  ) {
    if (project.type === "DOCKER") {
      const canResume =
        sessionRef.trim().length > 0 && sessionRef !== dbSessionId;
      return {
        cwd: process.env.HOME ?? "/",
        command: "docker",
        args: this.getDockerExecArgs(
          project.dockerContainer!,
          project.path,
          agentType,
          canResume ? sessionRef : undefined,
        ),
      };
    }

    if (agentType === AGENT_TYPES.TERMINAL) {
      return { cwd: project.path };
    }

    if (agentType === AGENT_TYPES.CODEX) {
      return {
        cwd: project.path,
        command: "codex",
        args: [],
      };
    }

    if (agentType === AGENT_TYPES.OPENCODE) {
      return {
        cwd: project.path,
        command: "opencode",
        args: [],
      };
    }

    const canResume =
      sessionRef.trim().length > 0 && sessionRef !== dbSessionId;
    return {
      cwd: project.path,
      command: "claude",
      args: canResume ? ["--resume", sessionRef, "--fork-session"] : [],
    };
  }

  private getDockerExecArgs(
    container: string,
    workdir: string,
    agentType: string,
    resumeSessionRef?: string,
  ): string[] {
    return [
      "exec",
      "-it",
      container,
      "/bin/bash",
      "-ilc",
      dockerInnerCommand(workdir, agentType, resumeSessionRef),
    ];
  }

  private bootstrapRemoteAgent(
    sessionId: string,
    req: Pick<CreateSessionRequest, "agentType" | "resumeSessionRef">,
    remoteProject: { path: string; dockerContainer: string | null },
  ): void {
    const pathPart = remoteProject.path.trim() || "$HOME";
    const isContainer = !!remoteProject.dockerContainer?.trim();
    const command = isContainer
      ? this.getRemoteDockerBootstrapCommand(
          remoteProject.dockerContainer!,
          pathPart,
          req.agentType,
          req.resumeSessionRef,
        )
      : this.getRemoteHostBootstrapCommand(
          pathPart,
          req.agentType,
          req.resumeSessionRef,
        );
    const timer = setTimeout(() => {
      this.bootstrapTimers.delete(sessionId);
      if (!remotePtyManager.has(sessionId)) return;
      remotePtyManager.write(sessionId, command);
    }, 120);
    this.bootstrapTimers.set(sessionId, timer);
  }

  private getRemoteHostBootstrapCommand(
    path: string,
    agentType: string,
    resumeSessionRef?: string,
  ): string {
    const qPath = shellQuote(path);
    if (agentType === AGENT_TYPES.TERMINAL) {
      return `cd ${qPath}\r`;
    }
    if (agentType === AGENT_TYPES.CODEX) {
      return `cd ${qPath} && codex\r`;
    }
    if (agentType === AGENT_TYPES.OPENCODE) {
      return `cd ${qPath} && opencode\r`;
    }
    if (resumeSessionRef?.trim()) {
      return `cd ${qPath} && claude --resume ${shellQuote(resumeSessionRef.trim())} --fork-session\r`;
    }
    return `cd ${qPath} && claude\r`;
  }

  private getRemoteDockerBootstrapCommand(
    container: string,
    workdir: string,
    agentType: string,
    resumeSessionRef?: string,
  ): string {
    const inner = dockerInnerCommand(workdir, agentType, resumeSessionRef);
    return `docker exec -it ${shellQuote(container.trim())} /bin/bash -ilc ${shellQuote(inner)}\r`;
  }

  startGC(): void {
    if (this.gcTimer) return;
    console.log(
      `[SessionManager] GC started (interval: ${GC_INTERVAL_MS / 1000}s, idle: ${GC_IDLE_MS / 1000}s)`,
    );
    this.gcTimer = setInterval(() => this.runGC(), GC_INTERVAL_MS);
  }

  stopGC(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  private async runGC(): Promise<void> {
    const localIdle = ptyManager.getIdleSessions(GC_IDLE_MS);
    const remoteIdle = remotePtyManager.getIdleSessions(GC_IDLE_MS);
    const idleSessions = [...localIdle, ...remoteIdle];
    if (idleSessions.length === 0) return;

    console.log(
      `[SessionManager] GC: terminating ${idleSessions.length} idle session(s)`,
    );
    for (const session of idleSessions) {
      await this.terminateSession(session.id);
    }
  }

  /** Scan remote Claude session history for an SSH project */
  async scanRemoteHistory(
    projectId: string,
    projectName: string,
    projectPath: string,
    sshConfigId: string,
    dockerContainer?: string,
  ): Promise<SessionInfo[]> {
    return scanRemoteSessions(
      sshConfigId,
      projectId,
      projectName,
      projectPath,
      dockerContainer,
    );
  }
}

export const sessionManager = new SessionManager();
