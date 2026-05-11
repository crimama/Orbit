import { NextResponse } from "next/server";
import { searchProjectFiles } from "@/server/files/projectFiles";
import {
  fileRouteError,
  findProjectForFiles,
  projectForFileOps,
} from "../_shared";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const found = await findProjectForFiles(params.id);
  if (found.error) return found.error;

  try {
    const url = new URL(request.url);
    const data = await searchProjectFiles(
      projectForFileOps(found.project),
      url.searchParams.get("q") ?? "",
      url.searchParams.get("path") ?? "",
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fileRouteError(error);
  }
}
