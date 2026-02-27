import { NextResponse } from "next/server";
import { sessionManager } from "@/server/session/sessionManager";
import { listClaudeHistorySessions } from "@/server/session/claudeHistory";
import { prisma } from "@/lib/prisma";
import type { CreateSessionRequest } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  const sessions = await sessionManager.listSessions(projectId);

  if (!projectId) {
    return NextResponse.json({ data: sessions });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, path: true, type: true, sshConfigId: true, dockerContainer: true },
  });

  if (!project) {
    return NextResponse.json({ data: sessions });
  }

  const history =
    project.type === "LOCAL" ||
    (project.type === "DOCKER" && !project.sshConfigId)
      ? await listClaudeHistorySessions(project.id, project.name, project.path)
      : (project.type === "SSH" || project.type === "DOCKER") &&
          project.sshConfigId
        ? await sessionManager.scanRemoteHistory(
            project.id,
            project.name,
            project.path,
            project.sshConfigId,
            project.dockerContainer ?? undefined,
          )
        : [];
  const runningRefs = new Set(sessions.map((s) => s.sessionRef));
  const merged = [
    ...sessions,
    ...history.filter((h) => !runningRefs.has(h.sessionRef)),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ data: merged });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateSessionRequest;

  if (!body.projectId || !body.agentType) {
    return NextResponse.json(
      { error: "projectId and agentType are required" },
      { status: 400 },
    );
  }

  try {
    const session = await sessionManager.createSession(body);
    return NextResponse.json({ data: session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
