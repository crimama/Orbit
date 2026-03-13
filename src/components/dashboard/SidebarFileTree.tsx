"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  ApiResponse,
  ProjectFileListResponse,
  ProjectFileReadResponse,
} from "@/lib/types";

interface SidebarFileTreeProps {
  projectId: string;
  files: { name: string; path: string; isDir: boolean }[];
  activePath?: string | null;
  initialDir?: string;
  onFileOpen?: (path: string, content: string) => void;
  onDirChange?: (dir: string) => void;
}

export default function SidebarFileTree({
  projectId,
  files,
  activePath,
  initialDir,
  onFileOpen,
  onDirChange,
}: SidebarFileTreeProps) {
  const [currentDir, setCurrentDir] = useState(initialDir ?? "");
  const [entries, setEntries] = useState<
    { name: string; path: string; isDir: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const navigateTo = useCallback(
    async (dirPath: string) => {
      setLoading(true);
      try {
        const query = dirPath
          ? new URLSearchParams({ path: dirPath }).toString()
          : "";
        const url = `/api/projects/${projectId}/files/list${query ? `?${query}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse<ProjectFileListResponse>;
        if (!("data" in json)) return;
        const items = json.data.entries.map((e) => ({
          name: e.name,
          path: e.path,
          isDir: e.isDir,
        }));
        setEntries(items);
        setCurrentDir(dirPath);
        onDirChange?.(dirPath);
      } finally {
        setLoading(false);
      }
    },
    [projectId, onDirChange],
  );

  // Load initial directory on mount or when project changes
  useEffect(() => {
    if (initialDir) {
      void navigateTo(initialDir);
    } else {
      // Use root files passed as props
      setEntries(files);
      setCurrentDir("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openFile = useCallback(
    async (filePath: string) => {
      if (!onFileOpen) return;
      setLoadingFile(filePath);
      try {
        const query = new URLSearchParams({ path: filePath }).toString();
        const res = await fetch(
          `/api/projects/${projectId}/files/read?${query}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse<ProjectFileReadResponse>;
        if (!("data" in json) || json.data.isBinary) return;
        onFileOpen(filePath, json.data.content ?? "");
      } finally {
        setLoadingFile(null);
      }
    },
    [projectId, onFileOpen],
  );

  const goUp = useCallback(() => {
    if (!currentDir) return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    void navigateTo(parts.join("/"));
  }, [currentDir, navigateTo]);

  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const dirLabel = currentDir
    ? currentDir.split("/").filter(Boolean).pop() ?? currentDir
    : "/";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-neutral-800 bg-neutral-900/40">
      {/* Current directory header */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-800 px-2 py-1.5">
        <span className="text-[10px] text-amber-400">📁</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-300">
          {dirLabel}
        </span>
        {loading && (
          <span className="text-[10px] text-neutral-500">…</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {/* Go up entry */}
        {currentDir && (
          <button
            type="button"
            onClick={goUp}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <span className="w-4 shrink-0 text-center text-neutral-500">↩</span>
            <span>..</span>
          </button>
        )}

        {sorted.length === 0 && !loading ? (
          <div className="px-2 py-4 text-center text-xs text-neutral-500">
            Empty directory
          </div>
        ) : (
          sorted.map((entry) => (
            <button
              key={entry.path}
              type="button"
              onClick={() => {
                if (entry.isDir) {
                  void navigateTo(entry.path);
                } else {
                  void openFile(entry.path);
                }
              }}
              className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-neutral-800 ${
                activePath === entry.path
                  ? "bg-neutral-800 text-neutral-100"
                  : entry.isDir
                    ? "text-amber-300/90"
                    : "text-neutral-300"
              }`}
              title={entry.path}
            >
              <span className="w-4 shrink-0 text-center text-[11px] text-neutral-500">
                {entry.isDir
                  ? "📂"
                  : loadingFile === entry.path
                    ? "…"
                    : "📄"}
              </span>
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {entry.isDir && (
                <span className="text-[10px] text-neutral-600">›</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
