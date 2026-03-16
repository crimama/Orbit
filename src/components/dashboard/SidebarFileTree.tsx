"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  ApiError,
  ApiResponse,
  ProjectFileListResponse,
  ProjectFileReadResponse,
} from "@/lib/types";
import ProjectDirPicker from "./ProjectDirPicker";

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface SidebarFileTreeProps {
  projectId: string;
  files: FileEntry[];
  activePath?: string | null;
  initialDir?: string;
  onFileOpen?: (path: string, content: string) => void;
  onDirChange?: (dir: string) => void;
}

function parentPath(p: string): string {
  const parts = p.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
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
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Context menu state ---
  const [ctxMenu, setCtxMenu] = useState<{
    entry: FileEntry;
    x: number;
    y: number;
  } | null>(null);
  // --- Dir picker state for copy/move ---
  const [picker, setPicker] = useState<{
    mode: "copy" | "move";
    entry: FileEntry;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const entryMapRef = useRef<Map<string, FileEntry>>(new Map());

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

  useEffect(() => {
    if (initialDir) {
      void navigateTo(initialDir);
    } else {
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

  // --- File operations ---
  class FetchError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  const doFetch = useCallback(
    async (endpoint: string, body: Record<string, unknown>) => {
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/files/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<{ ok: true }> | ApiError;
      if (!res.ok || "error" in json) {
        throw new FetchError(
          "error" in json ? json.error : `Failed to ${endpoint}`,
          res.status,
        );
      }
    },
    [projectId],
  );

  const renameEntry = useCallback(
    async (entry: FileEntry) => {
      const next = window.prompt("Rename", entry.name)?.trim();
      if (!next || next === entry.name) return;
      const toPath = parentPath(entry.path)
        ? `${parentPath(entry.path)}/${next}`
        : next;
      try {
        await doFetch("rename", { from: entry.path, to: toPath });
        await navigateTo(currentDir);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename");
      }
    },
    [currentDir, doFetch, navigateTo],
  );

  const openCopyPicker = useCallback((entry: FileEntry) => {
    setPicker({ mode: "copy", entry });
  }, []);

  const openMovePicker = useCallback((entry: FileEntry) => {
    setPicker({ mode: "move", entry });
  }, []);

  const handlePickerSelect = useCallback(
    async (destPath: string, destProjectId: string) => {
      if (!picker) return;
      const { mode, entry } = picker;
      setPicker(null);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          from: entry.path,
          to: destPath,
        };
        if (destProjectId !== projectId) {
          body.destProjectId = destProjectId;
        }
        await doFetch(mode, body);
        await navigateTo(currentDir);
      } catch (err) {
        // 409 = destination already exists — offer Replace or Ignore
        if (err instanceof FetchError && err.status === 409) {
          const replace = window.confirm(
            `"${destPath.split("/").pop()}" already exists.\n\nReplace it?`,
          );
          if (!replace) return; // Ignore
          try {
            const retryBody: Record<string, unknown> = {
              from: entry.path,
              to: destPath,
              overwrite: true,
            };
            if (destProjectId !== projectId) {
              retryBody.destProjectId = destProjectId;
            }
            await doFetch(mode, retryBody);
            await navigateTo(currentDir);
          } catch (retryErr) {
            setError(
              retryErr instanceof Error ? retryErr.message : `Failed to ${mode}`,
            );
          }
          return;
        }
        setError(
          err instanceof Error ? err.message : `Failed to ${mode}`,
        );
      }
    },
    [picker, projectId, currentDir, doFetch, navigateTo],
  );

  const deleteEntry = useCallback(
    async (entry: FileEntry) => {
      const ok = window.confirm(
        entry.isDir
          ? `Delete folder "${entry.name}"? (recursive)`
          : `Delete "${entry.name}"?`,
      );
      if (!ok) return;
      try {
        await doFetch("delete", { path: entry.path, recursive: entry.isDir });
        await navigateTo(currentDir);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    },
    [currentDir, doFetch, navigateTo],
  );

  // --- Native contextmenu listener ---
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const row = target?.closest<HTMLElement>("[data-entry-path]");
      if (!row) return;
      const path = row.dataset.entryPath;
      if (!path) return;
      const entry = entryMapRef.current.get(path);
      if (!entry) return;
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ entry, x: e.clientX, y: e.clientY });
    };
    el.addEventListener("contextmenu", handler);
    return () => el.removeEventListener("contextmenu", handler);
  }, []);

  // --- Dismiss context menu ---
  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    const raf = requestAnimationFrame(() => {
      window.addEventListener("mousedown", dismiss);
      window.addEventListener("keydown", onKey);
      window.addEventListener("scroll", dismiss, true);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [ctxMenu]);

  // --- Build sorted list ---
  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Keep entryMap in sync
  entryMapRef.current.clear();
  for (const entry of sorted) {
    entryMapRef.current.set(entry.path, entry);
  }

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

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
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
              data-entry-path={entry.path}
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

      {error ? (
        <div className="border-t border-red-900 bg-red-950/50 px-2 py-1 text-[11px] text-red-400">
          {error}
        </div>
      ) : null}

      {/* Right-click context menu */}
      {ctxMenu ? (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setCtxMenu(null)}
        >
          <button
            onClick={() => openCopyPicker(ctxMenu.entry)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
            type="button"
          >
            Copy
          </button>
          <button
            onClick={() => openMovePicker(ctxMenu.entry)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
            type="button"
          >
            Move
          </button>
          <button
            onClick={() => void renameEntry(ctxMenu.entry)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
            type="button"
          >
            Rename
          </button>
          <div className="mx-2 my-1 border-t border-neutral-700" />
          <button
            onClick={() => void deleteEntry(ctxMenu.entry)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700"
            type="button"
          >
            Delete
          </button>
        </div>
      ) : null}

      {picker ? (
        <ProjectDirPicker
          projectId={projectId}
          title={picker.mode === "copy" ? `Copy "${picker.entry.name}"` : `Move "${picker.entry.name}"`}
          defaultName={picker.mode === "copy" ? `${picker.entry.name}-copy` : picker.entry.name}
          onSelect={(dest, destPid) => void handlePickerSelect(dest, destPid)}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}
