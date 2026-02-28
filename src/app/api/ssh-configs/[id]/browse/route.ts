import { NextResponse } from "next/server";
import { sshManager } from "@/server/ssh/sshManager";
import { shellQuote } from "@/lib/shellQuote";
import type { BrowseResponse, DirEntry } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(request.url);
  const dockerContainer = searchParams.get("dockerContainer")?.trim() || "";
  const requestedPath =
    searchParams.get("path")?.trim() || (dockerContainer ? "/" : "$HOME");
  const rawPath = requestedPath.startsWith("~")
    ? `$HOME${requestedPath.slice(1)}`
    : requestedPath;

  try {
    const status = sshManager.getStatus(params.id);
    if (status.state !== "connected") {
      await sshManager.connect(params.id);
    }

    const quotedPath = shellQuote(rawPath);
    const browseScript = [
      `TARGET=${quotedPath}`,
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

    const output = await sshManager.exec(
      params.id,
      dockerContainer
        ? `docker exec -i ${shellQuote(dockerContainer)} sh -lc ${shellQuote(browseScript)}`
        : browseScript,
    );

    const lines = output.split("\n").map((line) => line.trimEnd());
    if (lines[0] === "__NOT_DIR__") {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const parentMarker = lines.indexOf("__PARENT__");
    const entriesMarker = lines.indexOf("__ENTRIES__");
    if (parentMarker <= 0 || entriesMarker <= parentMarker) {
      return NextResponse.json(
        { error: "Failed to parse remote directory listing" },
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
          err instanceof Error ? err.message : "Failed to browse remote directory",
      },
      { status: 400 },
    );
  }
}
