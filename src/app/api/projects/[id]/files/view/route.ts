import path from "path";
import { readProjectFileBinary } from "@/server/files/projectFiles";
import {
  fileRouteError,
  findProjectForFiles,
  projectForFileOps,
} from "../_shared";

function inlineFileName(filePath: string): string {
  const name = path.posix.basename(filePath) || "document.pdf";
  return name.replace(/["\\\r\n]/g, "_");
}

function isPdfPath(filePath: string): boolean {
  return /\.pdf$/i.test(filePath.trim());
}

function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
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
    if (!isPdfPath(requestedPath)) {
      return Response.json(
        { error: "Only PDF files can be viewed inline" },
        { status: 415 },
      );
    }

    const data = await readProjectFileBinary(
      projectForFileOps(found.project),
      requestedPath,
    );
    if (!looksLikePdf(data.buffer)) {
      return Response.json(
        { error: "File does not look like a valid PDF" },
        { status: 415 },
      );
    }

    return new Response(new Uint8Array(data.buffer), {
      headers: {
        "Content-Disposition": `inline; filename="${inlineFileName(
          data.path || requestedPath,
        )}"`,
        "Content-Length": String(data.size),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fileRouteError(error);
  }
}
