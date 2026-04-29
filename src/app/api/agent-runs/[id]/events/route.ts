import { NextResponse } from "next/server";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type { AgentRunEventType } from "@/lib/types";

const AGENT_RUN_EVENT_TYPES = [
  "run-created",
  "run-updated",
  "terminal-input",
  "terminal-output",
  "session-ready",
  "session-exit",
  "system",
] as const satisfies readonly AgentRunEventType[];

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function validateRunId(id: string) {
  return id.trim() ? undefined : badRequest("Agent run id is required");
}

function parseLimit(value: string | null): number | undefined | NextResponse {
  if (!value) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return badRequest("limit must be a positive integer");
  }
  return limit;
}

function parseEventType(
  value: string | null,
): AgentRunEventType | undefined | NextResponse {
  if (!value) return undefined;
  if (AGENT_RUN_EVENT_TYPES.includes(value as AgentRunEventType)) {
    return value as AgentRunEventType;
  }
  return badRequest(
    "type must be one of run-created, run-updated, terminal-input, terminal-output, session-ready, session-exit, system",
  );
}

function parseAfter(value: string | null): string | undefined | NextResponse {
  if (!value) return undefined;
  const rawSeq = value.includes(":") ? value.split(":").pop() : value;
  const seq = Number(rawSeq);
  if (!Number.isInteger(seq) || seq < 0) {
    return badRequest(
      "after must be a cursor ending in a non-negative sequence",
    );
  }
  return value;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const idError = validateRunId(params.id);
  if (idError) return idError;

  const run = await agentRunLedger.getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const after = parseAfter(searchParams.get("after"));
  if (after instanceof NextResponse) return after;
  const limit = parseLimit(searchParams.get("limit"));
  if (limit instanceof NextResponse) return limit;
  const type = parseEventType(searchParams.get("type"));
  if (type instanceof NextResponse) return type;

  const events = await agentRunLedger.listEvents(params.id, {
    after,
    limit,
    type,
  });

  return NextResponse.json({
    data: {
      run,
      events,
      nextCursor: events.at(-1)?.cursor ?? after ?? null,
    },
  });
}
