import { NextResponse } from "next/server";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type { AgentRunStatus, CreateAgentRunRequest } from "@/lib/types";

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const limit = Number(value);
  return Number.isFinite(limit) ? limit : undefined;
}

function parseStatus(value: string | null): AgentRunStatus | undefined {
  if (
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runs = await agentRunLedger.listRuns({
    projectId: searchParams.get("projectId") ?? undefined,
    sessionId: searchParams.get("sessionId") ?? undefined,
    status: parseStatus(searchParams.get("status")),
    limit: parseLimit(searchParams.get("limit")),
  });
  return NextResponse.json({ data: runs });
}

export async function POST(request: Request) {
  let body: CreateAgentRunRequest;
  try {
    body = (await request.json()) as CreateAgentRunRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.projectId || !body.agentType?.trim()) {
    return NextResponse.json(
      { error: "projectId and agentType are required" },
      { status: 400 },
    );
  }

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
