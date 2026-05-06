import path from "path";
import { PROJECT_FILES_MAX_VIEW_BYTES } from "@/lib/constants";
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

type ByteRange =
  | { ok: true; start: number; end: number }
  | { ok: false; status: 416 };

function parseRange(value: string | null, size: number): ByteRange | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return { ok: false, status: 416 };

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return { ok: false, status: 416 };

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { ok: false, status: 416 };
    }
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return { ok: false, status: 416 };
  }

  return { ok: true, start, end: Math.min(end, size - 1) };
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
      PROJECT_FILES_MAX_VIEW_BYTES,
    );
    if (!looksLikePdf(data.buffer)) {
      return Response.json(
        { error: "File does not look like a valid PDF" },
        { status: 415 },
      );
    }

    const range = parseRange(request.headers.get("range"), data.buffer.length);
    const baseHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${inlineFileName(
        data.path || requestedPath,
      )}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    };
    if (range && !range.ok) {
      return new Response(null, {
        status: range.status,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${data.buffer.length}`,
        },
      });
    }

    if (range?.ok) {
      const body = data.buffer.subarray(range.start, range.end + 1);
      return new Response(new Uint8Array(body), {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": String(body.length),
          "Content-Range": `bytes ${range.start}-${range.end}/${data.buffer.length}`,
        },
      });
    }

    return new Response(new Uint8Array(data.buffer), {
      headers: {
        ...baseHeaders,
        "Content-Length": String(data.buffer.length),
      },
    });
  } catch (error) {
    return fileRouteError(error);
  }
}
