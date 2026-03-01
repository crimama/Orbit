import { NextResponse } from "next/server";
import type { ProjectFileWriteRequest } from "@/lib/types";
import { writeProjectFile } from "@/server/files/projectFiles";
import {
  fileRouteError,
  findProjectForFiles,
  projectForFileOps,
} from "../_shared";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const found = await findProjectForFiles(params.id);
  if (found.error) return found.error;

  let body: ProjectFileWriteRequest;
  try {
    body = (await request.json()) as ProjectFileWriteRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content must be a string" },
      { status: 400 },
    );
  }

  try {
    const url = new URL(request.url);
    const data = await writeProjectFile(
      projectForFileOps(found.project),
      url.searchParams.get("path") ?? "",
      body,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fileRouteError(error);
  }
}
