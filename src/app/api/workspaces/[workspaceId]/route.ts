import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  UpdateWorkspaceLayoutRequest,
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

export async function PATCH(
  request: Request,
  { params }: { params: { workspaceId: string } },
) {
  const body = (await request.json()) as UpdateWorkspaceLayoutRequest;
  const data: {
    name?: string;
    tree?: string;
    activePaneId?: string | null;
  } = {};

  if (body.name !== undefined) {
    const nextName = body.name.trim();
    if (!nextName) {
      return NextResponse.json(
        { error: "name cannot be empty" },
        { status: 400 },
      );
    }
    data.name = nextName;
  }

  if (body.tree !== undefined) {
    if (!isJsonObject(body.tree)) {
      return NextResponse.json(
        { error: "tree must be valid JSON" },
        { status: 400 },
      );
    }
    data.tree = body.tree;
  }

  if (body.activePaneId !== undefined) {
    data.activePaneId = body.activePaneId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = await prisma.workspaceLayout.findFirst({
    where: { id: params.workspaceId, projectId: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const row = await prisma.workspaceLayout.update({
    where: { id: params.workspaceId },
    data,
  });
  return NextResponse.json({ data: toInfo(row) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { workspaceId: string } },
) {
  const result = await prisma.workspaceLayout.deleteMany({
    where: { id: params.workspaceId, projectId: null },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { deleted: true } });
}
