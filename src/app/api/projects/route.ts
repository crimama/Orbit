import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CreateProjectRequest, ProjectInfo } from "@/lib/types";

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export async function GET() {
  const projects = await prisma.project.findMany({
    include: { _count: { select: { sessions: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const data: ProjectInfo[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as ProjectInfo["type"],
    color: p.color,
    path: p.path,
    sshConfigId: p.sshConfigId,
    dockerContainer: p.dockerContainer,
    sessionCount: p._count.sessions,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateProjectRequest;

  if (!body.name || !body.path || !body.type) {
    return NextResponse.json(
      { error: "name, type, and path are required" },
      { status: 400 },
    );
  }

  if (body.color && !isValidHexColor(body.color)) {
    return NextResponse.json(
      { error: "color must be hex format like #22c55e" },
      { status: 400 },
    );
  }

  if (body.type === "SSH" && !body.sshConfigId) {
    return NextResponse.json(
      { error: "sshConfigId is required for SSH project" },
      { status: 400 },
    );
  }

  if (body.type === "DOCKER" && !body.dockerContainer) {
    return NextResponse.json(
      { error: "dockerContainer is required for DOCKER project" },
      { status: 400 },
    );
  }

  const project = await prisma.project.create({
    data: {
      name: body.name,
      type: body.type,
      color: body.color ?? "#64748b",
      path: body.path,
      ...(body.sshConfigId && { sshConfigId: body.sshConfigId }),
      ...(body.dockerContainer && { dockerContainer: body.dockerContainer }),
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

  return NextResponse.json({ data }, { status: 201 });
}
