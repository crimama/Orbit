import { NextResponse } from "next/server";
import { agentRunLedger } from "@/server/agentRuns/agentRunLedger";
import type { UpdateAgentRunRequest } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
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
  let body: UpdateAgentRunRequest;
  try {
    body = (await request.json()) as UpdateAgentRunRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
