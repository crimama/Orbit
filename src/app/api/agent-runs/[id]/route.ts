import { NextResponse } from "next/server";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type { AgentRunStatus, UpdateAgentRunRequest } from "@/lib/types";

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

function validateRunId(id: string) {
  return id.trim() ? undefined : badRequest("Agent run id is required");
}

function parseUpdateBody(body: unknown): UpdateAgentRunRequest | NextResponse {
  if (!isRecord(body)) {
    return badRequest("Request body must be a JSON object");
  }

  const update: UpdateAgentRunRequest = {};
  if ("title" in body) {
    if (body.title !== null && typeof body.title !== "string") {
      return badRequest("title must be a string or null");
    }
    update.title = body.title;
  }

  if ("status" in body) {
    if (
      typeof body.status !== "string" ||
      !AGENT_RUN_STATUSES.includes(body.status as AgentRunStatus)
    ) {
      return badRequest(
        "status must be one of running, completed, failed, cancelled",
      );
    }
    update.status = body.status as AgentRunStatus;
  }

  if ("metadata" in body) {
    if (!isRecord(body.metadata)) {
      return badRequest("metadata must be a JSON object");
    }
    update.metadata = body.metadata;
  }

  if (Object.keys(update).length === 0) {
    return badRequest("At least one of title, status, or metadata is required");
  }

  return update;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const idError = validateRunId(params.id);
  if (idError) return idError;

  const run = await agentRunLedger.getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
  }
  return NextResponse.json({ data: run });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const idError = validateRunId(params.id);
  if (idError) return idError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const body = parseUpdateBody(json);
  if (body instanceof NextResponse) return body;

  try {
    const run = await agentRunLedger.updateRun(params.id, body);
    await agentRunLedger.appendEvent(params.id, "run-updated", body, "api");
    return NextResponse.json({ data: run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update run";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const idError = validateRunId(params.id);
  if (idError) return idError;

  try {
    const run = await agentRunLedger.updateRun(params.id, {
      status: "cancelled",
    });
    await agentRunLedger.appendEvent(
      params.id,
      "run-updated",
      { status: "cancelled" },
      "api",
    );
    return NextResponse.json({ data: run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel run";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
