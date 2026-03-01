import { NextResponse } from "next/server";
import type { ProjectFileRenameRequest } from "@/lib/types";
import { renameProjectPath } from "@/server/files/projectFiles";
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

  let body: ProjectFileRenameRequest;
  try {
    body = (await request.json()) as ProjectFileRenameRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.from !== "string" || typeof body.to !== "string") {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 },
    );
  }

  try {
    const data = await renameProjectPath(
      projectForFileOps(found.project),
      body,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fileRouteError(error);
  }
}
