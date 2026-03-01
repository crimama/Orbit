import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProjectType } from "@/lib/types";
import { fileErrorMessage, fileErrorStatus } from "@/server/files/projectFiles";

export async function findProjectForFiles(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      type: true,
      path: true,
      sshConfigId: true,
      dockerContainer: true,
    },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
      project: null,
    };
  }

  return { error: null, project };
}

export function projectForFileOps(project: {
  id: string;
  type: string;
  path: string;
  sshConfigId: string | null;
  dockerContainer: string | null;
}) {
  return {
    id: project.id,
    type: project.type as ProjectType,
    path: project.path,
    sshConfigId: project.sshConfigId,
    dockerContainer: project.dockerContainer,
  };
}

export function fileRouteError(error: unknown) {
  return NextResponse.json(
    { error: fileErrorMessage(error) },
    { status: fileErrorStatus(error) },
  );
}
