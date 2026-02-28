import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  CreateWorkspaceLayoutRequest,
  WorkspaceLayoutInfo,
} from "@/lib/types";

function toInfo(row: {
  id: string;
  projectId: string | null;
  name: string;
  tree: string;
  activePaneId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceLayoutInfo {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    tree: row.tree,
    activePaneId: row.activePaneId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isJsonObject(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === "object";
  } catch {
    return false;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const rows = await prisma.workspaceLayout.findMany({
    where: { projectId: params.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ data: rows.map(toInfo) });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await request.json()) as CreateWorkspaceLayoutRequest;
  const name = body.name?.trim();
  const tree = body.tree;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!tree || !isJsonObject(tree)) {
    return NextResponse.json(
      { error: "tree must be valid JSON" },
      { status: 400 },
    );
  }

  const row = await prisma.workspaceLayout.create({
    data: {
      projectId: params.id,
      name,
      tree,
      activePaneId: body.activePaneId ?? null,
    },
  });

  return NextResponse.json({ data: toInfo(row) }, { status: 201 });
}
