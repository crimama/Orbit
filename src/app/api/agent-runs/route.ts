import { NextResponse } from "next/server";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type { AgentRunStatus, CreateAgentRunRequest } from "@/lib/types";

const AGENT_RUN_STATUSES = [
  "running",
  "completed",
  "failed",
  "cancelled",
] as const satisfies readonly AgentRunStatus[];

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(
  body: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  return typeof value === "string" ? value : undefined;
}

function parseLimit(value: string | null): number | undefined | NextResponse {
  if (!value) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return badRequest("limit must be a positive integer");
  }
  return limit;
}

function parseStatus(
  value: string | null,
): AgentRunStatus | undefined | NextResponse {
  if (!value) return undefined;
  if (AGENT_RUN_STATUSES.includes(value as AgentRunStatus)) {
    return value as AgentRunStatus;
  }
  return badRequest(
    "status must be one of running, completed, failed, cancelled",
  );
}

function parseCreateBody(body: unknown): CreateAgentRunRequest | NextResponse {
  if (!isRecord(body)) {
    return badRequest("Request body must be a JSON object");
  }

  const projectId = body.projectId;
  const agentType = body.agentType;
  if (typeof projectId !== "string" || !projectId.trim()) {
    return badRequest("projectId is required and must be a non-empty string");
  }
  if (typeof agentType !== "string" || !agentType.trim()) {
    return badRequest("agentType is required and must be a non-empty string");
  }

  const sessionId = optionalString(body, "sessionId");
  if (sessionId === undefined && "sessionId" in body) {
    return badRequest("sessionId must be a string or null");
  }
  const runRef = optionalString(body, "runRef");
  if (runRef === undefined && "runRef" in body) {
    return badRequest("runRef must be a string");
  }
  const title = optionalString(body, "title");
  if (title === undefined && "title" in body) {
    return badRequest("title must be a string or null");
  }
  const metadata = body.metadata;
  if (metadata !== undefined && !isRecord(metadata)) {
    return badRequest("metadata must be a JSON object");
  }

  return {
    projectId,
    agentType,
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(runRef !== undefined && runRef !== null ? { runRef } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = parseStatus(searchParams.get("status"));
  if (status instanceof NextResponse) return status;
  const limit = parseLimit(searchParams.get("limit"));
  if (limit instanceof NextResponse) return limit;

  const runs = await agentRunLedger.listRuns({
    projectId: searchParams.get("projectId") ?? undefined,
    sessionId: searchParams.get("sessionId") ?? undefined,
    status,
    limit,
  });
  return NextResponse.json({ data: runs });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const body = parseCreateBody(json);
  if (body instanceof NextResponse) return body;

  try {
    const run = await agentRunLedger.createRun(body);
    await agentRunLedger.appendEvent(
      run.id,
      "run-created",
      {
        projectId: run.projectId,
        sessionId: run.sessionId,
        runRef: run.runRef,
        agentType: run.agentType,
      },
      "api",
    );
    return NextResponse.json({ data: run }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create run";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
