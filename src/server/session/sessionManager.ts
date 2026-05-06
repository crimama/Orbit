import { readdir, realpath, stat } from "fs/promises";
import { homedir } from "os";
import { basename, join } from "path";
import { prisma } from "@/lib/prisma";
import { shellQuote } from "@/lib/shellQuote";
import { ptyManager } from "@/server/pty/ptyManager";
import { remotePtyManager } from "@/server/ssh/remotePty";
import { sshManager } from "@/server/ssh/sshManager";
import { scanRemoteSessions } from "@/server/ssh/remoteScanner";
import { toClaudeProjectKey } from "@/server/session/claudeHistory";
import { GC_IDLE_MS, GC_INTERVAL_MS } from "@/lib/constants";
import { sessionMetricsManager } from "@/server/observability/sessionMetrics";
import { auditLogger } from "@/server/audit/auditLogger";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type { SessionInfo, CreateSessionRequest } from "@/lib/types";
import type { OrbitServer } from "@/server/socket/types";

const AGENT_TYPES = {
  CLAUDE: "claude-code",
  TERMINAL: "terminal",
  CODEX: "codex",
  OPENCODE: "opencode",
} as const;

const READY_MARKER_CMD = "printf '\\033]777;orbit-ready\\007'";
const LOGIN_SHELL = process.env.SHELL?.trim() || "/bin/zsh";

function loginShellScript(script: string): { command: string; args: string[] } {
  return {
    command: LOGIN_SHELL,
    args: ["-lic", script],
  };
}

function fallbackInteractiveShell(): string {
  return 'exec "${SHELL:-/bin/zsh}" -l';
}

function runAgentOrFallback(
  displayName: string,
  commandCandidates: string[],
  args: string[],
): string {
  const quotedArgs = args.length > 0 ? ` ${args.map(shellQuote).join(" ")}` : "";
  const checks = commandCandidates
    .map((command) => {
      const qCommand = shellQuote(command);
      return (
        `if command -v ${qCommand} >/dev/null 2>&1; then ` +
        `${command}${quotedArgs}; status=$?; ` +
        `echo "[Agent Orbit] ${displayName} exited with status ${"$"}status."; ` +
        `${fallbackInteractiveShell()}; fi`
      );
    })
    .join("; ");

  return (
    `${READY_MARKER_CMD}; ${checks}; ` +
    `echo "[Agent Orbit] ${displayName} was not found in login shell PATH."; ` +
    `echo "[Agent Orbit] Install ${displayName} or add it to your shell profile PATH."; ` +
    fallbackInteractiveShell()
  );
}

function localAgentCommand(
  agentType: string,
  args: string[] = [],
): { command: string; args: string[] } {
  if (agentType === AGENT_TYPES.CODEX) {
    return loginShellScript(runAgentOrFallback("codex", ["codex"], args));
  }

  if (agentType === AGENT_TYPES.OPENCODE) {
    return loginShellScript(
      runAgentOrFallback("opencode", ["opencode"], args),
    );
  }

  return loginShellScript(
    runAgentOrFallback("claude/claude-code", ["claude", "claude-code"], args),
  );
}

function dockerInnerCommand(
  workdir: string,
  agentType: string,
  resumeSessionRef?: string,
): string {
  const qPath = shellQuote(workdir);
  if (agentType === AGENT_TYPES.TERMINAL) {
    return `cd ${qPath} 2>/dev/null || cd /; ${READY_MARKER_CMD}; exec /bin/bash -il`;
  }
  if (agentType === AGENT_TYPES.CODEX) {
    return `cd ${qPath} 2>/dev/null || cd /; ${READY_MARKER_CMD}; if command -v codex >/dev/null 2>&1; then exec codex; else echo "[Agent Orbit] codex not found in container PATH."; exec /bin/bash -il; fi`;
  }
  if (agentType === AGENT_TYPES.OPENCODE) {
    return `cd ${qPath} 2>/dev/null || cd /; ${READY_MARKER_CMD}; if command -v opencode >/dev/null 2>&1; then exec opencode; else echo "[Agent Orbit] opencode not found in container PATH."; exec /bin/bash -il; fi`;
  }
  const resumeArgs = resumeSessionRef?.trim()
    ? ` --resume ${shellQuote(resumeSessionRef.trim())}`
    : "";
  const claudeCmd =
    `if command -v claude >/dev/null 2>&1; then exec claude${resumeArgs}; ` +
    `elif command -v claude-code >/dev/null 2>&1; then exec claude-code${resumeArgs}; ` +
    `else echo "[Agent Orbit] claude/claude-code not found in container PATH."; exec /bin/sh; fi`;
  return `cd ${qPath} 2>/dev/null || cd /; ${READY_MARKER_CMD}; ${claudeCmd}`;
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

/** Trivial commands that should not trigger an auto-rename */
const TRIVIAL_COMMANDS = new Set([
  "ls",
  "ll",
  "la",
  "pwd",
  "cd",
  "clear",
  "cls",
  "exit",
  "quit",
  "echo",
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "man",
  "help",
  "history",
  "whoami",
  "date",
  "uptime",
  "top",
  "htop",
  "df",
  "du",
  "which",
  "where",
  "true",
  "false",
  "yes",
  "no",
  "",
]);

/** Minimum interval (ms) between auto-renames for the same session */
const AUTO_RENAME_DEBOUNCE_MS = 10_000;

/** Max display length for auto-generated session names */
const AUTO_RENAME_MAX_LEN = 50;

class SessionManager {
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private bootstrapTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activityBuffer = new Map<string, number>();
  private activityFlushTimer: ReturnType<typeof setInterval> | null = null;
  private socketServer: OrbitServer | null = null;
  private pendingSessionUpdates = new Map<string, SessionInfo>();
  private sessionUpdateTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private lastAutoRename = new Map<string, number>();
  private ensureRunningPromises = new Map<string, Promise<boolean>>();

  bindSocketServer(io: OrbitServer): void {
    this.socketServer = io;
  }

  startActivityFlusher(): void {
    if (this.activityFlushTimer) return;
    this.activityFlushTimer = setInterval(() => {
      void this.flushActivityBuffer();
    }, 5000);
  }

  stopActivityFlusher(): void {
    if (!this.activityFlushTimer) return;
    clearInterval(this.activityFlushTimer);
    this.activityFlushTimer = null;
    void this.flushActivityBuffer();
  }

  bufferActivity(sessionId: string): void {
    this.startActivityFlusher();
    this.activityBuffer.set(sessionId, Date.now());
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    this.bufferActivity(sessionId);
  }

  queueSessionUpdate(session: SessionInfo): void {
    this.pendingSessionUpdates.set(session.id, session);
    // Leading-edge debounce: first call starts a 2s timer; subsequent calls
    // only update the pending map (the timer reads the latest value on fire).
    if (this.sessionUpdateTimers.has(session.id)) return;

    const timer = setTimeout(() => {
      this.sessionUpdateTimers.delete(session.id);
      const next = this.pendingSessionUpdates.get(session.id);
      if (!next) return;
      this.pendingSessionUpdates.delete(session.id);
      this.socketServer?.to("dashboard").emit("session-update", next);
    }, 2000);

    this.sessionUpdateTimers.set(session.id, timer);
  }

  private async flushActivityBuffer(): Promise<void> {
    if (this.activityBuffer.size === 0) return;

    const entries = Array.from(this.activityBuffer.entries());
    this.activityBuffer.clear();

    await Promise.allSettled(
      entries.map(([sessionId, timestamp]) =>
        prisma.agentSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date(timestamp) },
        }),
      ),
    );
  }

  private registeredExitSessions = new Set<string>();

  private registerExitHandler(
    sessionId: string,
    backend: "local" | "remote" = "local",
  ): void {
    // Prevent duplicate registration on PTY restart
    if (this.registeredExitSessions.has(sessionId)) return;
    this.registeredExitSessions.add(sessionId);

    const manager = backend === "remote" ? remotePtyManager : ptyManager;
    manager.onExit(sessionId, async () => {
      this.registeredExitSessions.delete(sessionId);
      try {
        const row = await prisma.agentSession.update({
          where: { id: sessionId },
          data: { status: "terminated" },
          include: { project: { select: { name: true, color: true } } },
        });
        // Notify dashboard clients
        this.queueSessionUpdate(toSessionInfo(row));
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
    options?: {
      cols?: number;
      rows?: number;
      dangerouslySkipPermissions?: boolean;
    },
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
      {
        agentType,
        resumeSessionRef,
        dangerouslySkipPermissions: options?.dangerouslySkipPermissions,
      },
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

  private async generateSessionName(
    projectId: string,
    agentType: string,
  ): Promise<string> {
    const count = await prisma.agentSession.count({
      where: { projectId, agentType },
    });
    const label =
      agentType === AGENT_TYPES.CLAUDE
        ? "Claude"
        : agentType === "terminal"
          ? "Terminal"
          : agentType.charAt(0).toUpperCase() + agentType.slice(1);
    return `${label} #${count + 1}`;
  }

  private async getClaudeProjectDirs(projectPath: string): Promise<string[]> {
    const dirs = new Set<string>();
    const raw = projectPath.trim();
    if (!raw) return [];

    dirs.add(join(homedir(), ".claude", "projects", toClaudeProjectKey(raw)));

    try {
      const resolved = await realpath(raw);
      if (resolved.trim().length > 0) {
        dirs.add(
          join(homedir(), ".claude", "projects", toClaudeProjectKey(resolved)),
        );
      }
    } catch {
      // Project path may not resolve locally; keep the raw key only.
    }

    return Array.from(dirs);
  }

  private async resolveClaudeResumeRef(
    sessionRef: string,
    dbSessionId: string,
    projectPath: string,
  ): Promise<string | undefined> {
    const ref = sessionRef.trim();
    if (!ref || ref === dbSessionId) return undefined;

    const dirs = await this.getClaudeProjectDirs(projectPath);
    for (const dir of dirs) {
      try {
        const info = await stat(join(dir, `${ref}.jsonl`));
        if (info.isFile()) {
          return ref;
        }
      } catch {
        // Keep checking aliases.
      }
    }

    return undefined;
  }

  private async captureClaudeSessionRefOnce(
    sessionId: string,
    projectPath: string,
  ): Promise<boolean> {
    const projectKey = toClaudeProjectKey(projectPath);
    const claudeDir = join(homedir(), ".claude", "projects", projectKey);

    try {
      const files = await readdir(claudeDir, { withFileTypes: true });
      const jsonlFiles = files.filter(
        (file) => file.isFile() && file.name.endsWith(".jsonl"),
      );
      if (jsonlFiles.length === 0) return false;

      const entries = await Promise.all(
        jsonlFiles.map(async (file) => {
          const filePath = join(claudeDir, file.name);
          const info = await stat(filePath);
          return { filePath, mtimeMs: info.mtimeMs };
        }),
      );

      const newest = entries.reduce((latest, entry) =>
        entry.mtimeMs > latest.mtimeMs ? entry : latest,
      );
      const claudeSessionId = basename(newest.filePath, ".jsonl");
      if (!claudeSessionId) return false;

      const current = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        select: { sessionRef: true },
      });
      if (!current) return true;
      if (current.sessionRef === claudeSessionId) return true;

      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { sessionRef: claudeSessionId },
      });
      return true;
    } catch {
      // Best-effort capture only; session creation must not fail here.
      return false;
    }
  }

  private async captureClaudeSessionRef(
    sessionId: string,
    projectPath: string,
  ): Promise<void> {
    const retryDelays = [3000, 5000, 8000];
    for (const delay of retryDelays) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
      const captured = await this.captureClaudeSessionRefOnce(
        sessionId,
        projectPath,
      );
      if (captured) {
        return;
      }
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

    // Auto-generate a readable name if not provided
    let sessionName = req.name ?? null;
    if (!sessionName) {
      sessionName = await this.generateSessionName(
        req.projectId,
        req.agentType,
      );
    }

    const session = await prisma.agentSession.create({
      data: {
        projectId: req.projectId,
        name: sessionName,
        agentType: req.agentType,
        sessionRef: "",
        status: "active",
      },
      include: { project: { select: { name: true, color: true } } },
    });

    // Validate Docker config upfront
    if (
      (isRemote || isDocker) &&
      project.type === "DOCKER" &&
      !project.dockerContainer
    ) {
      await prisma.agentSession.delete({ where: { id: session.id } });
      throw new Error("dockerContainer is not configured for this project");
    }

    const nextSessionRef = req.resumeSessionRef?.trim() || session.id;

    // Store sessionRef + create options so ensureSessionRunning can start
    // the PTY lazily when session-attach fires from the Socket.io context.
    // This avoids module-instance mismatch between Next.js API routes and
    // the custom server's Socket.io handlers.
    await prisma.agentSession.update({
      where: { id: session.id },
      data: {
        sessionRef: nextSessionRef,
        lastContext: JSON.stringify({
          _createOpts: {
            resumeSessionRef: req.resumeSessionRef,
            cols: req.cols,
            rows: req.rows,
            dangerouslySkipPermissions: req.dangerouslySkipPermissions,
          },
        }),
      },
    });

    void auditLogger.log({
      eventType: "session_create",
      action: `Created session ${session.id}`,
      sessionId: session.id,
      projectId: session.projectId,
    });

    void agentRunLedger
      .ensureRunForSession(session.id)
      .then((run) =>
        run
          ? agentRunLedger.appendEvent(
              run.id,
              "run-created",
              {
                sessionId: session.id,
                projectId: session.projectId,
                agentType: session.agentType,
              },
              "session-manager",
            )
          : null,
      )
      .catch((err) => {
        console.error("[AgentRunLedger] failed to create session run:", err);
      });

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
    void auditLogger.log({
      eventType: "session_terminate",
      action: `Terminated session ${sessionId}`,
      sessionId,
    });
    void agentRunLedger
      .ensureRunForSession(sessionId)
      .then((run) =>
        run
          ? Promise.all([
              agentRunLedger.appendEvent(
                run.id,
                "session-exit",
                { status: "terminated" },
                "session-manager",
              ),
              agentRunLedger.updateRun(run.id, { status: "cancelled" }),
            ])
          : null,
      )
      .catch((err) => {
        console.error("[AgentRunLedger] failed to terminate run:", err);
      });
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

    const existing = this.ensureRunningPromises.get(sessionId);
    if (existing) return existing;

    const promise = this._doEnsureSessionRunning(sessionId);
    this.ensureRunningPromises.set(sessionId, promise);
    return promise.finally(() => {
      this.ensureRunningPromises.delete(sessionId);
    });
  }

  private async _doEnsureSessionRunning(sessionId: string): Promise<boolean> {
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

    // Guard: Docker must be configured if requested
    if (row.project.type === "DOCKER" && !row.project.dockerContainer) {
      return false;
    }

    const isRemote =
      (row.project.type === "SSH" || row.project.type === "DOCKER") &&
      !!row.project.sshConfigId;

    // Extract original create options if available (stored by createSession)
    let createOpts: {
      resumeSessionRef?: string;
      cols?: number;
      rows?: number;
      dangerouslySkipPermissions?: boolean;
    } = {};
    try {
      const parsed = row.lastContext ? JSON.parse(row.lastContext) : null;
      if (parsed?._createOpts) {
        createOpts = parsed._createOpts;
      }
    } catch {
      // lastContext may not be JSON
    }

    try {
      if (isRemote) {
        await this.startRemotePty(
          sessionId,
          row.project.sshConfigId!,
          row.agentType,
          createOpts.resumeSessionRef,
          {
            path: row.project.path,
            dockerContainer: row.project.dockerContainer,
          },
          {
            cols: createOpts.cols,
            rows: createOpts.rows,
            dangerouslySkipPermissions: createOpts.dangerouslySkipPermissions,
          },
        );
      } else {
        // Use original create options for brand-new sessions,
        // fall back to recover options for restarted sessions.
        if (
          createOpts.resumeSessionRef ||
          !this.hasValidClaudeRef(row.sessionRef, sessionId)
        ) {
          ptyManager.create(
            sessionId,
            this.getPtyOptionsForCreate(
              {
                projectId: row.projectId,
                agentType: row.agentType,
                resumeSessionRef: createOpts.resumeSessionRef,
                cols: createOpts.cols,
                rows: createOpts.rows,
                dangerouslySkipPermissions:
                  createOpts.dangerouslySkipPermissions,
              },
              {
                type: row.project.type,
                path: row.project.path,
                dockerContainer: row.project.dockerContainer,
              },
            ),
          );
        } else {
          const resumeSessionRef =
            row.agentType === AGENT_TYPES.CLAUDE
              ? await this.resolveClaudeResumeRef(
                  row.sessionRef,
                  sessionId,
                  row.project.path,
                )
              : row.sessionRef !== sessionId
                ? row.sessionRef
                : undefined;

          ptyManager.create(
            sessionId,
            this.getPtyOptionsForRecover(row.agentType, resumeSessionRef, {
              type: row.project.type,
              path: row.project.path,
              dockerContainer: row.project.dockerContainer,
            }),
          );
        }
        this.registerExitHandler(sessionId, "local");
      }

      // Re-activate terminated sessions after PTY is confirmed running
      if (row.status === "terminated") {
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { status: "active" },
        });
      }

      // Always clear _createOpts from lastContext after successful PTY start
      await prisma.agentSession
        .update({
          where: { id: sessionId },
          data: { lastContext: null },
        })
        .catch(() => {});

      // Capture Claude session ref for brand-new sessions
      if (
        row.agentType === AGENT_TYPES.CLAUDE &&
        !createOpts.resumeSessionRef
      ) {
        void this.captureClaudeSessionRef(sessionId, row.project.path);
      }

      return true;
    } catch (err) {
      console.error(
        `[SessionManager] ensureSessionRunning failed for ${sessionId}:`,
        err,
      );
      const message =
        err instanceof Error ? err.message : "Unknown terminal startup error";
      const updated = await prisma.agentSession
        .update({
          where: { id: sessionId },
          data: {
            status: "terminated",
            lastContext: `Local terminal start failed: ${message}`,
          },
          include: { project: { select: { name: true, color: true } } },
        })
        .catch(() => null);
      if (updated) {
        this.queueSessionUpdate(toSessionInfo(updated));
      }
      return false;
    }
  }

  private hasValidClaudeRef(sessionRef: string, dbSessionId: string): boolean {
    const ref = sessionRef.trim();
    return ref.length > 0 && ref !== dbSessionId;
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
      const command = localAgentCommand(req.agentType);
      return {
        cols: req.cols,
        rows: req.rows,
        cwd: project.path,
        ...command,
      };
    }

    if (req.agentType === AGENT_TYPES.OPENCODE) {
      const command = localAgentCommand(req.agentType);
      return {
        cols: req.cols,
        rows: req.rows,
        cwd: project.path,
        ...command,
      };
    }

    const resumeRef = req.resumeSessionRef?.trim();
    const args: string[] = resumeRef ? ["--resume", resumeRef] : [];
    if (req.dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }
    const command = localAgentCommand(req.agentType, args);
    return {
      cols: req.cols,
      rows: req.rows,
      cwd: project.path,
      ...command,
    };
  }

  private getPtyOptionsForRecover(
    agentType: string,
    resumeSessionRef: string | undefined,
    project: { type: string; path: string; dockerContainer: string | null },
  ) {
    if (project.type === "DOCKER") {
      return {
        cwd: process.env.HOME ?? "/",
        command: "docker",
        args: this.getDockerExecArgs(
          project.dockerContainer!,
          project.path,
          agentType,
          resumeSessionRef,
        ),
      };
    }

    if (agentType === AGENT_TYPES.TERMINAL) {
      return { cwd: project.path };
    }

    if (agentType === AGENT_TYPES.CODEX) {
      const command = localAgentCommand(agentType);
      return {
        cwd: project.path,
        ...command,
      };
    }

    if (agentType === AGENT_TYPES.OPENCODE) {
      const command = localAgentCommand(agentType);
      return {
        cwd: project.path,
        ...command,
      };
    }

    const args: string[] = resumeSessionRef
      ? ["--resume", resumeSessionRef]
      : [];
    // Note: dangerouslySkipPermissions is not persisted per-session,
    // so recovered sessions start in normal permission mode.
    const command = localAgentCommand(agentType, args);
    return {
      cwd: project.path,
      ...command,
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
    req: Pick<
      CreateSessionRequest,
      "agentType" | "resumeSessionRef" | "dangerouslySkipPermissions"
    >,
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
          req.dangerouslySkipPermissions,
        );
    const timer = setTimeout(() => {
      this.bootstrapTimers.delete(sessionId);
      if (!remotePtyManager.has(sessionId)) return;
      remotePtyManager.write(sessionId, command);

      // R-5: Watch for docker exec errors within a 5-second window
      if (isContainer) {
        this.watchDockerBootstrapErrors(sessionId);
      }
    }, 120);
    this.bootstrapTimers.set(sessionId, timer);
  }

  private getRemoteHostBootstrapCommand(
    path: string,
    agentType: string,
    resumeSessionRef?: string,
    dangerouslySkipPermissions?: boolean,
  ): string {
    const qPath = shellQuote(path);
    if (agentType === AGENT_TYPES.TERMINAL) {
      return `cd ${qPath} && ${READY_MARKER_CMD}\r`;
    }
    if (agentType === AGENT_TYPES.CODEX) {
      return `cd ${qPath} && ${READY_MARKER_CMD} && codex\r`;
    }
    if (agentType === AGENT_TYPES.OPENCODE) {
      return `cd ${qPath} && ${READY_MARKER_CMD} && opencode\r`;
    }
    const skipFlag = dangerouslySkipPermissions
      ? " --dangerously-skip-permissions"
      : "";
    if (resumeSessionRef?.trim()) {
      return `cd ${qPath} && ${READY_MARKER_CMD} && claude --resume ${shellQuote(resumeSessionRef.trim())}${skipFlag}\r`;
    }
    return `cd ${qPath} && ${READY_MARKER_CMD} && claude${skipFlag}\r`;
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

  private static readonly DOCKER_ERROR_PATTERNS = [
    "Error response from daemon",
    "No such container",
    "OCI runtime",
    "is not running",
    "Cannot connect to the Docker daemon",
  ];

  private watchDockerBootstrapErrors(sessionId: string): void {
    let outputAccum = "";
    let unsub: (() => void) | null = null;

    const cleanup = () => {
      if (unsub) {
        unsub();
        unsub = null;
      }
      clearTimeout(watchTimer);
    };

    const onData = (data: string) => {
      outputAccum += data;
      const matched = SessionManager.DOCKER_ERROR_PATTERNS.some((pattern) =>
        outputAccum.includes(pattern),
      );
      if (matched) {
        cleanup();
        console.error(
          `[SessionManager] Docker exec error detected for session ${sessionId}`,
        );
        void prisma.agentSession
          .update({
            where: { id: sessionId },
            data: { status: "terminated" },
            include: { project: { select: { name: true, color: true } } },
          })
          .then((row) => {
            this.queueSessionUpdate(toSessionInfo(row));
          })
          .catch(() => {});
      }
    };

    try {
      unsub = remotePtyManager.onData(sessionId, onData);
    } catch {
      // Session may not exist yet
      return;
    }

    const watchTimer = setTimeout(() => {
      cleanup();
    }, 5_000);
  }

  /**
   * Auto-rename a session based on the latest user input.
   * Skips trivial shell commands, debounces, and respects userRenamed flag.
   */
  async autoRenameFromInput(
    sessionId: string,
    rawInput: string,
  ): Promise<void> {
    const command = rawInput.replace(/[\r\n]+$/, "").trim();
    if (!command) return;

    // Extract first word to check triviality
    const firstWord = command
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/^.*\//, "");
    if (TRIVIAL_COMMANDS.has(firstWord)) return;

    // Debounce
    const now = Date.now();
    const lastTs = this.lastAutoRename.get(sessionId) ?? 0;
    if (now - lastTs < AUTO_RENAME_DEBOUNCE_MS) return;
    this.lastAutoRename.set(sessionId, now);

    // Check userRenamed flag
    const row = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { userRenamed: true },
    });
    if (!row || row.userRenamed) return;

    // Truncate for display
    const newName =
      command.length > AUTO_RENAME_MAX_LEN
        ? command.slice(0, AUTO_RENAME_MAX_LEN - 1) + "…"
        : command;

    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { name: newName },
    });

    // Broadcast update to dashboard
    const session = await this.getSession(sessionId);
    if (session) {
      this.queueSessionUpdate(session);
    }
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
    this.stopActivityFlusher();
    this.sessionUpdateTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.sessionUpdateTimers.clear();
    this.pendingSessionUpdates.clear();
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
      const terminated = await this.getSession(session.id);
      if (terminated) {
        this.queueSessionUpdate(terminated);
      }
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

// globalThis singleton — same instance across Next.js webpack + custom server
const SM_KEY = "__orbit_session_manager__" as const;
const _g = globalThis as unknown as Record<string, SessionManager | undefined>;
if (!_g[SM_KEY]) {
  _g[SM_KEY] = new SessionManager();
}
export const sessionManager: SessionManager = _g[SM_KEY];
