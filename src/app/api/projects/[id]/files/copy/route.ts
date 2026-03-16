import { NextResponse } from "next/server";
import type { ProjectFileCopyRequest } from "@/lib/types";
import { copyProjectPath } from "@/server/files/projectFiles";
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

  let body: ProjectFileCopyRequest;
  try {
    body = (await request.json()) as ProjectFileCopyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.from !== "string" || typeof body.to !== "string") {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 },
    );
  }

  let destProjectRecord: ReturnType<typeof projectForFileOps> | undefined;
  if (body.destProjectId && body.destProjectId !== params.id) {
    const destFound = await findProjectForFiles(body.destProjectId);
    if (destFound.error) return destFound.error;
    destProjectRecord = projectForFileOps(destFound.project);
  }

  try {
    const data = await copyProjectPath(
      projectForFileOps(found.project),
      body,
      destProjectRecord,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fileRouteError(error);
  }
}
