import { prisma } from "@/lib/prisma";
import type { FileLockInfo } from "@/lib/types";

function toInfo(row: {
  id: string;
  projectId: string;
  filePath: string;
  sessionId: string;
  lineRange: string;
  description: string | null;
  createdAt: Date;
}): FileLockInfo {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function acquireLock(
  projectId: string,
  filePath: string,
  sessionId: string,
  description?: string,
): Promise<FileLockInfo> {
  const lock = await prisma.fileLock.create({
    data: { projectId, filePath, sessionId, description },
  });
  return toInfo(lock);
}

export async function releaseLock(
  projectId: string,
  filePath: string,
): Promise<void> {
  await prisma.fileLock.deleteMany({ where: { projectId, filePath } });
}

export async function listLocks(projectId: string): Promise<FileLockInfo[]> {
  const locks = await prisma.fileLock.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "asc" }],
  });
  return locks.map(toInfo);
}

export async function detectConflicts(
  projectId: string,
  files: string[],
): Promise<FileLockInfo[]> {
  const locks = await prisma.fileLock.findMany({
    where: { projectId, filePath: { in: files } },
    orderBy: [{ createdAt: "asc" }],
  });
  return locks.map(toInfo);
}
