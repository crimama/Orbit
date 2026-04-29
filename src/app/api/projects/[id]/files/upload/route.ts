import { NextResponse } from "next/server";
import { uploadProjectFile } from "@/server/files/projectFiles";
import type { ProjectFileUploadResponse, ProjectFileUploadedItem } from "@/lib/types";
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

  try {
    const form = await request.formData();
    const targetDir = form.get("path");
    const files = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const uploaded: ProjectFileUploadedItem[] = [];
    for (const file of files) {
      const name = file.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Uploaded file name is required" },
          { status: 400 },
        );
      }

      const data = Buffer.from(await file.arrayBuffer());
      const nextPath =
        typeof targetDir === "string" && targetDir
          ? `${targetDir}/${name}`
          : name;
      const result = await uploadProjectFile(
        projectForFileOps(found.project),
        nextPath,
        data,
      );
      uploaded.push({
        name,
        path: result.path,
        size: result.size,
      });
    }

    const response: ProjectFileUploadResponse = { uploaded };
    return NextResponse.json({ data: response });
  } catch (error) {
    return fileRouteError(error);
  }
}
