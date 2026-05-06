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

function asciiFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/["\\\r\n]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim();
  return sanitized || "download";
}

function attachmentContentDisposition(filePath: string): string {
  const name = downloadFileName(filePath);
  return `attachment; filename="${asciiFileName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`;
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
        "Content-Disposition": attachmentContentDisposition(
          data.path || requestedPath,
        ),
        "Content-Type": "application/octet-stream",
      },
    });
  } catch (error) {
    return fileRouteError(error);
  }
}
