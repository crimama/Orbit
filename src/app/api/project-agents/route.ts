import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProjectAgentInfo, CreateProjectAgentRequest } from "@/lib/types";

function toInfo(row: {
  id: string;
  projectId: string;
  name: string;
  agentType: string;
  createdAt: Date;
  updatedAt: Date;
}): ProjectAgentInfo {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    agentType: row.agentType as ProjectAgentInfo["agentType"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query parameter is required" },
      { status: 400 },
    );
  }

  const rows = await prisma.projectAgent.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: rows.map(toInfo) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateProjectAgentRequest;
  if (!body.projectId || !body.name || !body.agentType) {
    return NextResponse.json(
      { error: "projectId, name, agentType are required" },
      { status: 400 },
    );
  }
  if (
    !["terminal", "claude-code", "codex", "opencode"].includes(body.agentType)
  ) {
    return NextResponse.json(
      {
        error:
          'agentType must be "terminal" | "claude-code" | "codex" | "opencode"',
      },
      { status: 400 },
    );
  }

  try {
    const row = await prisma.projectAgent.create({
      data: {
        projectId: body.projectId,
        name: body.name.trim(),
        agentType: body.agentType,
      },
    });
    return NextResponse.json({ data: toInfo(row) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create project agent" },
      { status: 400 },
    );
  }
}
