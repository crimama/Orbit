import path from "path";
import { readProjectFile } from "@/server/files/projectFiles";
import {
  fileRouteError,
  findProjectForFiles,
  projectForFileOps,
} from "../_shared";

function downloadFileName(filePath: string): string {
  const name = path.posix.basename(filePath) || "download";
  return name.replace(/["\\\r\n]/g, "_");
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const found = await findProjectForFiles(params.id);
  if (found.error) return found.error;

  try {
    const url = new URL(request.url);
    const requestedPath = url.searchParams.get("path") ?? "";
    const data = await readProjectFile(
      projectForFileOps(found.project),
      requestedPath,
    );
    const buffer = data.isBinary
      ? Buffer.from(data.content ?? "", "base64")
      : Buffer.from(data.content ?? "", "utf8");

    return new Response(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${downloadFileName(
          data.path || requestedPath,
        )}"`,
        "Content-Type": "application/octet-stream",
      },
    });
  } catch (error) {
    return fileRouteError(error);
  }
}
