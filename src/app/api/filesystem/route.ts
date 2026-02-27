import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { resolve, dirname } from "path";
import { homedir } from "os";
import type { BrowseResponse, DirEntry } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path") || homedir();
  const current = resolve(rawPath);

  try {
    const info = await stat(current);
    if (!info.isDirectory()) {
      return NextResponse.json(
        { error: "Not a directory" },
        { status: 400 },
      );
    }

    const items = await readdir(current, { withFileTypes: true });

    const entries: DirEntry[] = items
      .filter((item) => {
        // Hide hidden files/dirs (dotfiles) unless explicitly browsing
        if (item.name.startsWith(".")) return false;
        // Only show directories
        return item.isDirectory();
      })
      .map((item) => ({
        name: item.name,
        path: resolve(current, item.name),
        isDir: item.isDirectory(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parent = current === "/" ? null : dirname(current);

    const data: BrowseResponse = { current, parent, entries };
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: `Cannot read directory: ${current}` },
      { status: 400 },
    );
  }
}
