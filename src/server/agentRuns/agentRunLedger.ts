import { prisma } from "@/lib/prisma";
import type {
  AgentRunEventInfo,
  AgentRunEventType,
  AgentRunInfo,
  CreateAgentRunRequest,
  ListAgentRunEventsOptions,
  ListAgentRunsOptions,
  UpdateAgentRunRequest,
} from "@/lib/types";

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_LIMIT = 500;
const DEFAULT_RUN_LIMIT = 50;
const MAX_RUN_LIMIT = 200;
const ACTIVE_STATUSES = new Set(["running"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringifyMetadata(value: unknown): string {
  return JSON.stringify(parseJsonObject(value));
}

function clampLimit(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.min(Math.max(Math.trunc(value!), 1), max);
}

function toRunInfo(row: {
  id: string;
  projectId: string;
  sessionId: string | null;
  runRef: string;
  agentType: string;
  title: string | null;
  status: string;
  metadata: string;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { events: number };
}): AgentRunInfo {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    runRef: row.runRef,
    agentType: row.agentType,
    title: row.title,
    status: row.status as AgentRunInfo["status"],
    metadata: parseJsonObject(row.metadata),
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    eventCount: row._count?.events ?? 0,
  };
}

function toEventInfo(row: {
  id: string;
  runId: string;
  seq: number;
  cursor: string;
  type: string;
  source: string | null;
  payload: string;
  createdAt: Date;
}): AgentRunEventInfo {
  return {
    id: row.id,
    runId: row.runId,
    seq: row.seq,
    cursor: row.cursor,
    type: row.type as AgentRunEventType,
    source: row.source,
    payload: parseJsonObject(row.payload),
    createdAt: row.createdAt.toISOString(),
  };
}

function seqFromCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined;
  const raw = cursor.includes(":") ? cursor.split(":").pop() : cursor;
  const seq = Number(raw);
  return Number.isInteger(seq) && seq >= 0 ? seq : undefined;
}

class AgentRunLedger {
  async createRun(req: CreateAgentRunRequest): Promise<AgentRunInfo> {
    const project = await prisma.project.findUnique({
      where: { id: req.projectId },
      select: { id: true },
    });
    if (!project) throw new Error(`Project not found: ${req.projectId}`);

    if (req.sessionId) {
      const session = await prisma.agentSession.findUnique({
        where: { id: req.sessionId },
        select: { id: true, projectId: true },
      });
      if (!session) throw new Error(`Session not found: ${req.sessionId}`);
      if (session.projectId !== req.projectId) {
        throw new Error("Session does not belong to project");
      }
    }

    const row = await prisma.agentRun.create({
      data: {
        projectId: req.projectId,
        sessionId: req.sessionId ?? null,
        runRef: req.runRef?.trim() || crypto.randomUUID(),
        agentType: req.agentType.trim(),
        title: req.title?.trim() || null,
        metadata: stringifyMetadata(req.metadata),
      },
      include: { _count: { select: { events: true } } },
    });
    return toRunInfo(row);
  }

  async ensureRunForSession(sessionId: string): Promise<AgentRunInfo | null> {
    const existing = await prisma.agentRun.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { events: true } } },
    });
    if (existing) return toRunInfo(existing);

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { id: true, projectId: true, agentType: true, name: true },
    });
    if (!session) return null;

    const row = await prisma.agentRun.create({
      data: {
        projectId: session.projectId,
        sessionId: session.id,
        runRef: session.id,
        agentType: session.agentType,
        title: session.name,
        metadata: stringifyMetadata({ createdFrom: "session" }),
      },
      include: { _count: { select: { events: true } } },
    });
    return toRunInfo(row);
  }

  async listRuns(options: ListAgentRunsOptions = {}): Promise<AgentRunInfo[]> {
    const rows = await prisma.agentRun.findMany({
      where: {
        ...(options.projectId ? { projectId: options.projectId } : {}),
        ...(options.sessionId ? { sessionId: options.sessionId } : {}),
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: clampLimit(options.limit, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT),
      include: { _count: { select: { events: true } } },
    });
    return rows.map(toRunInfo);
  }

  async getRun(id: string): Promise<AgentRunInfo | null> {
    const row = await prisma.agentRun.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    return row ? toRunInfo(row) : null;
  }

  async updateRun(
    id: string,
    req: UpdateAgentRunRequest,
  ): Promise<AgentRunInfo> {
    if (
      req.status &&
      !ACTIVE_STATUSES.has(req.status) &&
      !TERMINAL_STATUSES.has(req.status)
    ) {
      throw new Error("Invalid run status");
    }

    const row = await prisma.agentRun.update({
      where: { id },
      data: {
        ...(req.title !== undefined
          ? { title: req.title?.trim() || null }
          : {}),
        ...(req.metadata !== undefined
          ? { metadata: stringifyMetadata(req.metadata) }
          : {}),
        ...(req.status
          ? {
              status: req.status,
              endedAt: TERMINAL_STATUSES.has(req.status) ? new Date() : null,
            }
          : {}),
      },
      include: { _count: { select: { events: true } } },
    });
    return toRunInfo(row);
  }

  async appendEventBySession(
    sessionId: string,
    type: AgentRunEventType,
    payload: unknown,
    source?: string,
  ): Promise<AgentRunEventInfo | null> {
    const run = await this.ensureRunForSession(sessionId);
    if (!run) return null;
    return this.appendEvent(run.id, type, payload, source);
  }

  async appendEvent(
    runId: string,
    type: AgentRunEventType,
    payload: unknown,
    source?: string,
  ): Promise<AgentRunEventInfo> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const row = await prisma.$transaction(async (tx) => {
          const latest = await tx.agentRunEvent.findFirst({
            where: { runId },
            orderBy: { seq: "desc" },
            select: { seq: true },
          });
          const seq = (latest?.seq ?? 0) + 1;
          const event = await tx.agentRunEvent.create({
            data: {
              runId,
              seq,
              cursor: `${runId}:${seq}`,
              type,
              source: source ?? null,
              payload: JSON.stringify(payload ?? null),
            },
          });
          await tx.agentRun.update({
            where: { id: runId },
            data: { updatedAt: new Date() },
          });
          return event;
        });
        return toEventInfo(row);
      } catch (err) {
        if (attempt === 2) throw err;
      }
    }
    throw new Error("Failed to append run event");
  }

  async listEvents(
    runId: string,
    options: ListAgentRunEventsOptions = {},
  ): Promise<AgentRunEventInfo[]> {
    const afterSeq = seqFromCursor(options.after);
    const rows = await prisma.agentRunEvent.findMany({
      where: {
        runId,
        ...(afterSeq !== undefined ? { seq: { gt: afterSeq } } : {}),
        ...(options.type ? { type: options.type } : {}),
      },
      orderBy: { seq: "asc" },
      take: clampLimit(options.limit, DEFAULT_EVENT_LIMIT, MAX_EVENT_LIMIT),
    });
    return rows.map(toEventInfo);
  }
}

export const agentRunLedger = new AgentRunLedger();
