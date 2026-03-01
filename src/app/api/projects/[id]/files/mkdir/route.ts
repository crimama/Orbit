import { NextResponse } from "next/server";
import type { ProjectFileMkdirRequest } from "@/lib/types";
import { mkdirProjectPath } from "@/server/files/projectFiles";
import {
  fileRouteError,
  findProjectForFiles,
  projectForFileOps,
} from "../_shared";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const found = await findProjectForFiles(params.id);
  if (found.error) return found.error;

  let body: ProjectFileMkdirRequest;
  try {
    body = (await request.json()) as ProjectFileMkdirRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.path !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const data = await mkdirProjectPath(
      projectForFileOps(found.project),
      body.path,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fileRouteError(error);
  }
}
