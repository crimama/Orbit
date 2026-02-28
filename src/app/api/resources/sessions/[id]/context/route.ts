import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SessionContextResource, SessionInfo } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await prisma.agentSession.findUnique({
    where: { id: params.id },
    include: { project: { select: { name: true, color: true, path: true } } },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const data: SessionInfo = {
    id: session.id,
    projectId: session.projectId,
    projectName: session.project.name,
    projectColor: session.project.color,
    name: session.name,
    agentType: session.agentType,
    sessionRef: session.sessionRef,
    status: session.status as SessionInfo["status"],
    lastContext: session.lastContext,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    source: "orbit",
  };

  const resource: SessionContextResource = {
    uri: `orbit://session/${session.id}/context`,
    session: data,
    projectPath: session.project.path,
    next: [
      {
        uri: `orbit://session/${session.id}/metrics`,
        title: "Check Runtime Metrics",
        description:
          "Review recent errors, active duration, and event stream health.",
      },
      {
        uri: `orbit://project/${session.projectId}/context`,
        title: "Open Project Context",
        description:
          "Validate project harness and environment before risky commands.",
      },
      {
        uri: `orbit://session/${session.id}/safety`,
        title: "Run Safety Checklist",
        description:
          "Use allowlist-first flow for destructive or privileged commands.",
      },
    ],
  };

  return NextResponse.json({ data: resource });
}
