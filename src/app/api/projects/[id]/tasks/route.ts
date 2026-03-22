import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTask, listTasks } from "@/server/coordination/taskManager";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const data = await listTasks(params.id);
  return NextResponse.json({ data });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    priority?: number;
    deps?: string[];
    files?: string[];
  };
  const title = body.title?.trim();

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const data = await createTask({
    projectId: params.id,
    title,
    description: body.description,
    priority: body.priority,
    deps: body.deps,
    files: body.files,
  });
  return NextResponse.json({ data }, { status: 201 });
}
