import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProjectContextResource, ProjectInfo } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const sessionCount = await prisma.agentSession.count({
    where: { projectId: project.id, status: "active" },
  });

  const harnessRows = await prisma.$queryRaw<{ enabled: number }[]>`
    SELECT enabled FROM ProjectHarnessConfig WHERE projectId = ${project.id} LIMIT 1
  `;
  const harnessEnabled =
    harnessRows.length > 0 ? harnessRows[0].enabled === 1 : false;

  const data: ProjectInfo = {
    id: project.id,
    name: project.name,
    type: project.type as ProjectInfo["type"],
    color: project.color,
    path: project.path,
    sshConfigId: project.sshConfigId,
    dockerContainer: project.dockerContainer,
    sessionCount,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };

  const resource: ProjectContextResource = {
    uri: `orbit://project/${project.id}/context`,
    project: data,
    activeSessions: sessionCount,
    harnessEnabled,
    next: [
      {
        uri: `orbit://project/${project.id}/harness`,
        title: "Review Harness Policy",
        description:
          "Check provider profile and guardrail settings before creating a session.",
      },
      {
        uri: `orbit://project/${project.id}/sessions`,
        title: "Open Active Sessions",
        description:
          "Create a new session or resume from existing session history.",
      },
      {
        uri: `orbit://project/${project.id}/skills`,
        title: "Inspect Skill Graph",
        description:
          "Verify skill dependencies and trace visibility before automation runs.",
      },
    ],
  };

  return NextResponse.json({ data: resource });
}
