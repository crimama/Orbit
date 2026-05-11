"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  ApiError,
  ApiResponse,
  ProjectFileListResponse,
  ProjectFileReadResponse,
  ProjectFileSearchResponse,
  ProjectFileUploadResponse,
} from "@/lib/types";
import ProjectDirPicker from "./ProjectDirPicker";

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface RecentFileShortcut {
  path: string;
  name: string;
  openedAt: number;
}

interface SidebarFileTreeProps {
  projectId: string;
  files: FileEntry[];
  activePath?: string | null;
  initialDir?: string;
  recentFiles?: RecentFileShortcut[];
  onFileOpen?: (
    path: string,
    content: string,
    mtimeMs: number,
    viewer?: "editor" | "pdf",
  ) => void;
  onDirChange?: (dir: string) => void;
}

function parentPath(p: string): string {
  const parts = p.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

class FetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export default function SidebarFileTree({
  projectId,
  files,
  activePath,
  initialDir,
  recentFiles = [],
  onFileOpen,
  onDirChange,
}: SidebarFileTreeProps) {
  const [currentDir, setCurrentDir] = useState(initialDir ?? "");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FileEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<{
    truncated: boolean;
    visited: number;
  } | null>(null);

  // --- Context menu state ---
  const [ctxMenu, setCtxMenu] = useState<{
    entry: FileEntry | null; // null = blank space right-click
    x: number;
    y: number;
  } | null>(null);
  // --- Dir picker state for copy/move ---
  const [picker, setPicker] = useState<{
    mode: "copy" | "move";
    entry: FileEntry;
  } | null>(null);
  const [nameDialog, setNameDialog] = useState<{
    mode: "file" | "folder" | "rename";
    title: string;
    value: string;
    entry?: FileEntry;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedSearchQuery.length < 2) {
      setSearchResults([]);
      setSearchMeta(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setError(null);

    const params = new URLSearchParams({
      q: debouncedSearchQuery,
    });
    if (currentDir) {
      params.set("path", currentDir);
    }

    void fetch(`/api/projects/${projectId}/files/search?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as
          | ApiResponse<ProjectFileSearchResponse>
          | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error(
            "error" in json ? json.error : "Failed to search files",
          );
        }
        setSearchResults(
          json.data.entries.map((entry) => ({
            name: entry.name,
            path: entry.path,
            isDir: entry.isDir,
          })),
        );
        setSearchMeta({
          truncated: json.data.truncated,
          visited: json.data.visited,
        });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSearchResults([]);
        setSearchMeta(null);
        setError(err instanceof Error ? err.message : "Failed to search files");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      });

    return () => controller.abort();
  }, [currentDir, debouncedSearchQuery, projectId]);

  const openFile = useCallback(
    async (filePath: string) => {
      if (!onFileOpen) return;
      if (/\.pdf$/i.test(filePath)) {
        onFileOpen(filePath, "", 0, "pdf");
        return;
      }
      setLoadingFile(filePath);
      try {
        const query = new URLSearchParams({ path: filePath }).toString();
        const res = await fetch(
          `/api/projects/${projectId}/files/read?${query}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse<ProjectFileReadResponse>;
        if (!("data" in json)) return;
        if (json.data.isBinary) {
          setError("Binary files cannot be opened in the editor");
          return;
        }
        onFileOpen(filePath, json.data.content ?? "", json.data.mtimeMs);
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
    async (entry: FileEntry, nextName: string) => {
      const next = nextName.trim();
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

  const createFile = useCallback(
    async (nextName: string) => {
      const name = nextName.trim();
      if (!name) return;
      const fullPath = currentDir ? `${currentDir}/${name}` : name;
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/files/write?${new URLSearchParams({ path: fullPath }).toString()}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: "", create: true }),
          },
        );
        const json = (await res.json()) as ApiResponse<{ ok: true }> | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error(
            "error" in json ? json.error : "Failed to create file",
          );
        }
        await navigateTo(currentDir);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create file");
      }
    },
    [currentDir, projectId, navigateTo],
  );

  const createFolder = useCallback(
    async (nextName: string) => {
      const name = nextName.trim();
      if (!name) return;
      const fullPath = currentDir ? `${currentDir}/${name}` : name;
      setError(null);
      try {
        await doFetch("mkdir", { path: fullPath });
        await navigateTo(currentDir);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create folder",
        );
      }
    },
    [currentDir, doFetch, navigateTo],
  );

  const openCreateFileDialog = useCallback(() => {
    setNameDialog({
      mode: "file",
      title: "New File",
      value: "untitled.txt",
    });
  }, []);

  const openCreateFolderDialog = useCallback(() => {
    setNameDialog({
      mode: "folder",
      title: "New Folder",
      value: "new-folder",
    });
  }, []);

  const openUploadPicker = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const uploadFiles = useCallback(
    async (fileList: FileList | null) => {
      const selectedFiles = Array.from(fileList ?? []);
      if (selectedFiles.length === 0) return;

      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        if (currentDir) {
          form.append("path", currentDir);
        }
        for (const file of selectedFiles) {
          form.append("files", file);
        }

        const res = await fetch(`/api/projects/${projectId}/files/upload`, {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as
          | ApiResponse<ProjectFileUploadResponse>
          | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Failed to upload");
        }
        await navigateTo(currentDir);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload");
      } finally {
        setUploading(false);
        if (uploadInputRef.current) {
          uploadInputRef.current.value = "";
        }
      }
    },
    [currentDir, navigateTo, projectId],
  );

  const openRenameDialog = useCallback((entry: FileEntry) => {
    setNameDialog({
      mode: "rename",
      title: `Rename ${entry.isDir ? "Folder" : "File"}`,
      value: entry.name,
      entry,
    });
  }, []);

  const submitNameDialog = useCallback(async () => {
    if (!nameDialog) return;
    const value = nameDialog.value.trim();
    if (!value) return;
    const current = nameDialog;
    setNameDialog(null);

    if (current.mode === "file") {
      await createFile(value);
      return;
    }
    if (current.mode === "folder") {
      await createFolder(value);
      return;
    }
    if (current.entry) {
      await renameEntry(current.entry, value);
    }
  }, [createFile, createFolder, nameDialog, renameEntry]);

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
              retryErr instanceof Error
                ? retryErr.message
                : `Failed to ${mode}`,
            );
          }
          return;
        }
        setError(err instanceof Error ? err.message : `Failed to ${mode}`);
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

  const downloadFile = useCallback(
    async (entry: FileEntry) => {
      if (entry.isDir) return;
      setError(null);

      let objectUrl: string | null = null;
      try {
        const query = new URLSearchParams({ path: entry.path }).toString();
        const res = await fetch(
          `/api/projects/${projectId}/files/download?${query}`,
          { method: "GET" },
        );

        if (!res.ok) {
          let message = "Failed to download file";
          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const json = (await res.json()) as ApiError;
            if ("error" in json && json.error) {
              message = json.error;
            }
          }
          throw new Error(message);
        }

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = entry.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        const urlToRevoke = objectUrl;
        window.setTimeout(() => {
          URL.revokeObjectURL(urlToRevoke);
        }, 0);
        objectUrl = null;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to download file",
        );
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }
    },
    [projectId],
  );

  // --- Native contextmenu listener ---
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const row = target?.closest<HTMLElement>("[data-entry-path]");
      e.preventDefault();
      e.stopPropagation();
      if (row) {
        const path = row.dataset.entryPath;
        const entry = path ? entryMapRef.current.get(path) : null;
        if (entry) {
          setCtxMenu({ entry, x: e.clientX, y: e.clientY });
          return;
        }
      }
      // Blank space — show create menu
      setCtxMenu({ entry: null, x: e.clientX, y: e.clientY });
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
  const hasSearch = debouncedSearchQuery.length >= 2;
  const displayedEntries = hasSearch ? searchResults : entries;
  const sorted = [...displayedEntries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Keep entryMap in sync
  entryMapRef.current.clear();
  for (const entry of sorted) {
    entryMapRef.current.set(entry.path, entry);
  }

  const dirLabel = currentDir
    ? (currentDir.split("/").filter(Boolean).pop() ?? currentDir)
    : "/";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-neutral-800 bg-neutral-900/40">
      {/* Current directory header */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-800 px-2 py-1.5">
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void uploadFiles(event.currentTarget.files)}
        />
        <span className="text-[10px] text-amber-400">📁</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-300">
          {dirLabel}
        </span>
        {(loading || uploading) && (
          <span className="text-[10px] text-neutral-500">…</span>
        )}
        <button
          type="button"
          onClick={openUploadPicker}
          disabled={uploading}
          className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          title="Upload files"
        >
          Upload
        </button>
        <button
          type="button"
          onClick={openCreateFileDialog}
          className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
          title="New file"
        >
          + File
        </button>
        <button
          type="button"
          onClick={openCreateFolderDialog}
          className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
          title="New folder"
        >
          + Folder
        </button>
      </div>

      <div className="shrink-0 border-b border-neutral-800 px-2 py-1.5">
        <div className="flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-950 px-2 py-1">
          <span className="text-[10px] text-neutral-500">⌕</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search files"
            className="min-w-0 flex-1 bg-transparent text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
          />
          {searching ? (
            <span className="text-[10px] text-neutral-500">…</span>
          ) : null}
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearchQuery("");
                setSearchResults([]);
                setSearchMeta(null);
              }}
              className="rounded px-1 text-[10px] text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              title="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>
        {hasSearch && searchMeta ? (
          <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-neutral-500">
            <span>{searchResults.length} matches</span>
            <span>
              {searchMeta.truncated
                ? `limited after ${searchMeta.visited}`
                : `${searchMeta.visited} checked`}
            </span>
          </div>
        ) : searchQuery.trim().length === 1 ? (
          <div className="mt-1 px-1 text-[10px] text-neutral-600">
            Type at least 2 characters
          </div>
        ) : null}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
        {!hasSearch && recentFiles.length > 0 ? (
          <div className="mb-1 border-b border-neutral-800 pb-1">
            <div className="px-2 pb-1 text-[10px] font-medium uppercase text-neutral-500">
              Recent
            </div>
            {recentFiles.slice(0, 5).map((item) => (
              <button
                key={`${item.path}:${item.openedAt}`}
                type="button"
                onClick={() => void openFile(item.path)}
                className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-neutral-800 ${
                  activePath === item.path
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-cyan-200/90"
                }`}
                title={item.path}
              >
                <span className="w-4 shrink-0 text-center text-[11px] text-neutral-500">
                  ↻
                </span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Go up entry */}
        {!hasSearch && currentDir && (
          <button
            type="button"
            onClick={goUp}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <span className="w-4 shrink-0 text-center text-neutral-500">↩</span>
            <span>..</span>
          </button>
        )}

        {sorted.length === 0 && !loading && !searching ? (
          <div className="px-2 py-4 text-center text-xs text-neutral-500">
            {hasSearch ? "No matches" : "Empty directory"}
          </div>
        ) : (
          sorted.map((entry) => (
            <button
              key={entry.path}
              type="button"
              data-entry-path={entry.path}
              onClick={() => {
                if (entry.isDir) {
                  setSearchQuery("");
                  setDebouncedSearchQuery("");
                  setSearchResults([]);
                  setSearchMeta(null);
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
                {entry.isDir ? "📂" : loadingFile === entry.path ? "…" : "📄"}
              </span>
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {hasSearch && parentPath(entry.path) ? (
                <span className="min-w-0 max-w-[45%] truncate text-[10px] text-neutral-600">
                  {parentPath(entry.path)}
                </span>
              ) : null}
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
          {ctxMenu.entry ? (
            <>
              {!ctxMenu.entry.isDir ? (
                <button
                  onClick={() => void downloadFile(ctxMenu.entry!)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                  type="button"
                >
                  Download
                </button>
              ) : null}
              <button
                onClick={() => openCopyPicker(ctxMenu.entry!)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                type="button"
              >
                Copy
              </button>
              <button
                onClick={() => openMovePicker(ctxMenu.entry!)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                type="button"
              >
                Move
              </button>
              <button
                onClick={() => openRenameDialog(ctxMenu.entry!)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                type="button"
              >
                Rename
              </button>
              <div className="mx-2 my-1 border-t border-neutral-700" />
              <button
                onClick={() => void deleteEntry(ctxMenu.entry!)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700"
                type="button"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={openCreateFileDialog}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                type="button"
              >
                New File
              </button>
              <button
                onClick={openCreateFolderDialog}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                type="button"
              >
                New Folder
              </button>
              <div className="mx-2 my-1 border-t border-neutral-700" />
              <button
                onClick={openUploadPicker}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                type="button"
              >
                Upload File
              </button>
            </>
          )}
        </div>
      ) : null}

      {picker ? (
        <ProjectDirPicker
          projectId={projectId}
          title={
            picker.mode === "copy"
              ? `Copy "${picker.entry.name}"`
              : `Move "${picker.entry.name}"`
          }
          defaultName={
            picker.mode === "copy"
              ? `${picker.entry.name}-copy`
              : picker.entry.name
          }
          onSelect={(dest, destPid) => void handlePickerSelect(dest, destPid)}
          onClose={() => setPicker(null)}
        />
      ) : null}

      {nameDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onMouseDown={() => setNameDialog(null)}
        >
          <form
            className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void submitNameDialog();
            }}
          >
            <h3 className="text-sm font-semibold text-neutral-100">
              {nameDialog.title}
            </h3>
            <input
              autoFocus
              value={nameDialog.value}
              onChange={(event) =>
                setNameDialog((current) =>
                  current ? { ...current, value: event.target.value } : current,
                )
              }
              className="mt-3 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-border-focus"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNameDialog(null)}
                className="rounded px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!nameDialog.value.trim()}
                className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
