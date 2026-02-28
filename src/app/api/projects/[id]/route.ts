import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProjectInfo } from "@/lib/types";
import {
  registerProject,
  unregisterProject,
} from "@/server/project/projectRegistry";

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { _count: { select: { sessions: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const data: ProjectInfo = {
    id: project.id,
    name: project.name,
    type: project.type as ProjectInfo["type"],
    color: project.color,
    path: project.path,
    sshConfigId: project.sshConfigId,
    dockerContainer: project.dockerContainer,
    sessionCount: project._count.sessions,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };

  return NextResponse.json({ data });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : null;
  const color = typeof body.color === "string" ? body.color.trim() : null;
  const path = typeof body.path === "string" ? body.path.trim() : null;
  const hasDockerContainer = Object.prototype.hasOwnProperty.call(
    body,
    "dockerContainer",
  );
  const dockerContainer =
    typeof body.dockerContainer === "string"
      ? body.dockerContainer.trim()
      : null;

  if (!name && !color && !path && !hasDockerContainer) {
    return NextResponse.json(
      { error: "name, color, path, or dockerContainer is required" },
      { status: 400 },
    );
  }

  if (color && !isValidHexColor(color)) {
    return NextResponse.json(
      { error: "color must be hex format like #22c55e" },
      { status: 400 },
    );
  }

  if (path !== null && !path) {
    return NextResponse.json(
      { error: "path cannot be empty" },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.project.findUnique({
      where: { id: params.id },
      include: { _count: { select: { sessions: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (hasDockerContainer && existing.type === "DOCKER" && !dockerContainer) {
      return NextResponse.json(
        { error: "dockerContainer is required for DOCKER project" },
        { status: 400 },
      );
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name ? { name } : {}),
        ...(color ? { color } : {}),
        ...(path ? { path } : {}),
        ...(hasDockerContainer
          ? { dockerContainer: dockerContainer || null }
          : {}),
      },
      include: { _count: { select: { sessions: true } } },
    });

    const data: ProjectInfo = {
      id: project.id,
      name: project.name,
      type: project.type as ProjectInfo["type"],
      color: project.color,
      path: project.path,
      sshConfigId: project.sshConfigId,
      dockerContainer: project.dockerContainer,
      sessionCount: project._count.sessions,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };

    await registerProject({
      projectId: project.id,
      name: project.name,
      type: project.type,
      path: project.path,
    });

    return NextResponse.json({ data });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.agentSession.deleteMany({
        where: { projectId: params.id },
      });
      await tx.project.delete({ where: { id: params.id } });
    });
    await unregisterProject(params.id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
