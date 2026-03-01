import { NextResponse } from "next/server";
import type { ProjectFileDeleteRequest } from "@/lib/types";
import { deleteProjectPath } from "@/server/files/projectFiles";
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

  let body: ProjectFileDeleteRequest;
  try {
    body = (await request.json()) as ProjectFileDeleteRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.path !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const data = await deleteProjectPath(
      projectForFileOps(found.project),
      body,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fileRouteError(error);
  }
}
