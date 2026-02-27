import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import type { BrowseResponse, DirEntry } from "@/lib/types";

const execFileAsync = promisify(execFile);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const container = searchParams.get("container")?.trim() || "";
  const requestedPath = searchParams.get("path")?.trim() || "/";
  const rawPath = requestedPath.startsWith("~")
    ? `/root${requestedPath.slice(1)}`
    : requestedPath;

  if (!container) {
    return NextResponse.json(
      { error: "container is required" },
      { status: 400 },
    );
  }

  try {
    const browseScript = [
      'TARGET="$1"',
      'if [ ! -d "$TARGET" ]; then echo "__NOT_DIR__"; exit 2; fi',
      'cd "$TARGET" || exit 2',
      "CURRENT=$(pwd)",
      'echo "$CURRENT"',
      'echo "__PARENT__"',
      'dirname "$CURRENT"',
      'echo "__ENTRIES__"',
      'find "$CURRENT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null ' +
        '| sed "s#^.*/##" ' +
        '| LC_ALL=C sort',
    ].join("; ");

    const { stdout } = await execFileAsync("docker", [
      "exec",
      "-i",
      container,
      "sh",
      "-lc",
      browseScript,
      "sh",
      rawPath,
    ]);

    const lines = stdout.split("\n").map((line) => line.trimEnd());
    if (lines[0] === "__NOT_DIR__") {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const parentMarker = lines.indexOf("__PARENT__");
    const entriesMarker = lines.indexOf("__ENTRIES__");
    if (parentMarker <= 0 || entriesMarker <= parentMarker) {
      return NextResponse.json(
        { error: "Failed to parse docker directory listing" },
        { status: 500 },
      );
    }

    const current = lines[0];
    const parentRaw = lines[parentMarker + 1] ?? "/";
    const names = lines
      .slice(entriesMarker + 1)
      .filter((name) => name.length > 0 && !name.startsWith("."));

    const entries: DirEntry[] = names.map((name) => ({
      name,
      path: current === "/" ? `/${name}` : `${current}/${name}`,
      isDir: true,
    }));

    const parent = current === "/" || parentRaw === current ? null : parentRaw;
    const data: BrowseResponse = { current, parent, entries };
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to browse docker directory",
      },
      { status: 400 },
    );
  }
}
