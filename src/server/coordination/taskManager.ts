import { prisma } from "@/lib/prisma";
import type { AgentTaskInfo } from "@/lib/types";

function toInfo(row: {
  id: string;
  projectId: string;
  sessionId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  assignee: string | null;
  deps: string | null;
  files: string | null;
  result: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AgentTaskInfo {
  return {
    ...row,
    status: row.status as AgentTaskInfo["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTasks(projectId: string): Promise<AgentTaskInfo[]> {
  const tasks = await prisma.agentTask.findMany({
    where: { projectId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return tasks.map(toInfo);
}

export async function createTask(data: {
  projectId: string;
  title: string;
  description?: string;
  priority?: number;
  deps?: string[];
  files?: string[];
}): Promise<AgentTaskInfo> {
  const task = await prisma.agentTask.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      priority: data.priority ?? 0,
      deps: data.deps ? JSON.stringify(data.deps) : null,
      files: data.files ? JSON.stringify(data.files) : null,
    },
  });
  return toInfo(task);
}

export async function updateTask(
  id: string,
  data: Partial<{ status: string; assignee: string; result: string }>,
): Promise<AgentTaskInfo> {
  const task = await prisma.agentTask.update({ where: { id }, data });
  return toInfo(task);
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.agentTask.delete({ where: { id } });
}
