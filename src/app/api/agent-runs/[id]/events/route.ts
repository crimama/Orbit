import { NextResponse } from "next/server";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type { AgentRunEventType } from "@/lib/types";

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const limit = Number(value);
  return Number.isFinite(limit) ? limit : undefined;
}

function parseEventType(value: string | null): AgentRunEventType | undefined {
  if (!value) return undefined;
  return value as AgentRunEventType;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const run = await agentRunLedger.getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const events = await agentRunLedger.listEvents(params.id, {
    after: searchParams.get("after") ?? undefined,
    limit: parseLimit(searchParams.get("limit")),
    type: parseEventType(searchParams.get("type")),
  });

  return NextResponse.json({
    data: {
      run,
      events,
      nextCursor: events.at(-1)?.cursor ?? searchParams.get("after") ?? null,
    },
  });
}
