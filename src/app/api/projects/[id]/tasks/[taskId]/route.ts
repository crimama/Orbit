import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateTask, deleteTask } from "@/server/coordination/taskManager";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; taskId: string } },
) {
  const existing = await prisma.agentTask.findUnique({
    where: { id: params.taskId },
    select: { projectId: true },
  });
  if (!existing || existing.projectId !== params.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<{
    status: string;
    assignee: string;
    result: string;
  }>;

  if (
    body.status === undefined &&
    body.assignee === undefined &&
    body.result === undefined
  ) {
    return NextResponse.json(
      { error: "At least one field is required" },
      { status: 400 },
    );
  }

  try {
    const data = await updateTask(params.taskId, {
      status: body.status,
      assignee: body.assignee,
      result: body.result,
    });
    return NextResponse.json({ data });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; taskId: string } },
) {
  const existing = await prisma.agentTask.findUnique({
    where: { id: params.taskId },
    select: { projectId: true },
  });
  if (!existing || existing.projectId !== params.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    await deleteTask(params.taskId);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}
