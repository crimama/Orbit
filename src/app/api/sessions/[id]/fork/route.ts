import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionManager } from "@/server/session/sessionManager";

interface ForkSessionRequest {
  checkpointId?: string;
  name?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as ForkSessionRequest;
  const checkpointId =
    typeof body.checkpointId === "string" ? body.checkpointId.trim() : "";

  if (!checkpointId) {
    return NextResponse.json(
      { error: "checkpointId is required" },
      { status: 400 },
    );
  }

  const checkpoint = await prisma.sessionCheckpoint.findUnique({
    where: { id: checkpointId },
  });
  if (!checkpoint || checkpoint.sessionId !== params.id) {
    return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
  }

  const origSession = await prisma.agentSession.findUnique({
    where: { id: checkpoint.sessionId },
  });
  if (!origSession) {
    return NextResponse.json(
      { error: "Original session not found" },
      { status: 404 },
    );
  }

  try {
    const newSession = await sessionManager.createSession({
      projectId: origSession.projectId,
      agentType: origSession.agentType,
      name:
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : `Fork of ${origSession.name || origSession.id.slice(0, 8)}`,
      resumeSessionRef: origSession.sessionRef,
    });

    return NextResponse.json({ data: newSession }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fork session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
