import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getProjectRegistryPath,
  listRegisteredProjects,
  registerProject,
} from "@/server/project/projectRegistry";

const STALE_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  let projects = await listRegisteredProjects();
  if (projects.length === 0) {
    const fromDb = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, type: true, path: true },
    });
    for (const row of fromDb) {
      await registerProject({
        projectId: row.id,
        name: row.name,
        type: row.type,
        path: row.path,
      });
    }
    projects = await listRegisteredProjects();
  }
  const now = Date.now();

  const data = {
    uri: "orbit://projects/registry",
    registryPath: getProjectRegistryPath(),
    count: projects.length,
    projects: projects.map((project) => {
      const updatedAtMs = new Date(project.updatedAt).getTime();
      const stale = Number.isFinite(updatedAtMs)
        ? now - updatedAtMs > STALE_MS
        : false;
      return {
        ...project,
        stale,
      };
    }),
  };

  return NextResponse.json({ data });
}
