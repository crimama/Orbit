"use client";

import { useState, useCallback } from "react";
import type {
  ApiResponse,
  ProjectFileListResponse,
  ProjectFileReadResponse,
} from "@/lib/types";

interface SidebarFileTreeProps {
  projectId: string;
  files: { name: string; path: string; isDir: boolean }[];
  activePath?: string | null;
  onFileOpen?: (path: string, content: string) => void;
}

interface DirNode {
  loaded: boolean;
  expanded: boolean;
  children: { name: string; path: string; isDir: boolean }[];
}

export default function SidebarFileTree({
  projectId,
  files,
  activePath,
  onFileOpen,
}: SidebarFileTreeProps) {
  const [dirs, setDirs] = useState<Record<string, DirNode>>({});
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const toggleDir = useCallback(
    async (dirPath: string) => {
      const existing = dirs[dirPath];
      if (existing?.loaded) {
        setDirs((prev) => ({
          ...prev,
          [dirPath]: { ...prev[dirPath], expanded: !prev[dirPath].expanded },
        }));
        return;
      }

      setLoadingPath(dirPath);
      try {
        const query = new URLSearchParams({ path: dirPath }).toString();
        const res = await fetch(
          `/api/projects/${projectId}/files/list?${query}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse<ProjectFileListResponse>;
        if (!("data" in json)) return;
        const children = json.data.entries.map((e) => ({
          name: e.name,
          path: e.path,
          isDir: e.isDir,
        }));
        setDirs((prev) => ({
          ...prev,
          [dirPath]: { loaded: true, expanded: true, children },
        }));
      } finally {
        setLoadingPath(null);
      }
    },
    [projectId, dirs],
  );

  const openFile = useCallback(
    async (filePath: string) => {
      if (!onFileOpen) return;
      setLoadingPath(filePath);
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
        setLoadingPath(null);
      }
    },
    [projectId, onFileOpen],
  );

  const renderEntries = (
    entries: { name: string; path: string; isDir: boolean }[],
    depth: number,
  ) => {
    const sorted = [...entries].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map((entry) => {
      const isLoading = loadingPath === entry.path;
      const dirNode = entry.isDir ? dirs[entry.path] : null;
      const isExpanded = dirNode?.expanded ?? false;

      return (
        <div key={entry.path}>
          <button
            type="button"
            onClick={() => {
              if (entry.isDir) {
                void toggleDir(entry.path);
              } else {
                void openFile(entry.path);
              }
            }}
            className={`flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-xs hover:bg-neutral-800 ${
              activePath === entry.path
                ? "bg-neutral-800 text-neutral-100"
                : entry.isDir
                  ? "text-amber-300/90"
                  : "text-neutral-300"
            }`}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            title={entry.path}
          >
            <span className="w-3 shrink-0 text-center text-[10px] text-neutral-500">
              {entry.isDir
                ? isLoading
                  ? "…"
                  : isExpanded
                    ? "▾"
                    : "▸"
                : ""}
            </span>
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          </button>
          {entry.isDir && isExpanded && dirNode?.children && (
            <div>{renderEntries(dirNode.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="max-h-72 overflow-y-auto rounded border border-neutral-800 bg-neutral-900/40 p-1">
      {files.length === 0 ? (
        <div className="px-2 py-6 text-center text-xs text-neutral-500">
          No indexed files.
        </div>
      ) : (
        renderEntries(files, 0)
      )}
    </div>
  );
}
