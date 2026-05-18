"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiError,
  ApiResponse,
  ProjectFileEntryInfo,
  ProjectFileListResponse,
  ProjectFileReadResponse,
  ProjectFileSearchResponse,
} from "@/lib/types";

interface MobileFilesPanelProps {
  projectId: string | null;
  projectName: string | null;
}

type ViewerState =
  | { kind: "none" }
  | { kind: "loading"; path: string }
  | { kind: "text"; path: string; content: string; size: number }
  | { kind: "binary"; path: string; size: number }
  | { kind: "error"; path: string; message: string };

const MAX_INLINE_TEXT_BYTES = 1_000_000;

function parentPath(value: string): string {
  if (!value) return "";
  const parts = value.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function formatSize(value: number | null): string {
  if (value == null) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function isViewableAsset(path: string): boolean {
  return /\.(pdf|png|jpe?g|gif|webp|svg)$/i.test(path);
}

function fileBadge(entry: ProjectFileEntryInfo): string {
  if (entry.isDir) return "/";
  if (/\.pdf$/i.test(entry.path)) return "PDF";
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(entry.path)) return "IMG";
  const ext = entry.name.split(".").pop();
  if (ext && ext !== entry.name && ext.length <= 4) return ext.toUpperCase();
  return "TXT";
}

function viewUrl(projectId: string, path: string): string {
  const params = new URLSearchParams({ path });
  return `/api/projects/${projectId}/files/view?${params.toString()}`;
}

export default function MobileFilesPanel({
  projectId,
  projectName,
}: MobileFilesPanelProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<ProjectFileEntryInfo[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProjectFileEntryInfo[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState>({ kind: "none" });

  const searching = query.trim().length >= 2;
  const visibleEntries = searching ? searchResults : entries;

  const pathCrumbs = useMemo(
    () => currentPath.split("/").filter(Boolean),
    [currentPath],
  );

  const loadDirectory = useCallback(
    async (path: string) => {
      if (!projectId) return;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (path) params.set("path", path);
        const res = await fetch(
          `/api/projects/${projectId}/files/list?${params.toString()}`,
        );
        const json = (await res.json()) as
          | ApiResponse<ProjectFileListResponse>
          | ApiError;
        if (!res.ok || !("data" in json)) {
          throw new Error(
            "error" in json ? json.error : "Failed to load files",
          );
        }
        setCurrentPath(json.data.current);
        setEntries(json.data.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    setCurrentPath("");
    setEntries([]);
    setSearchResults([]);
    setQuery("");
    setViewer({ kind: "none" });
    if (projectId) void loadDirectory("");
  }, [loadDirectory, projectId]);

  useEffect(() => {
    if (!projectId) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: trimmed,
        path: currentPath,
      });
      fetch(`/api/projects/${projectId}/files/search?${params.toString()}`)
        .then((res) => res.json().then((json) => ({ res, json })))
        .then(
          ({
            res,
            json,
          }: {
            res: Response;
            json: ApiResponse<ProjectFileSearchResponse> | ApiError;
          }) => {
            if (!res.ok || !("data" in json)) {
              throw new Error(
                "error" in json ? json.error : "Failed to search files",
              );
            }
            setSearchResults(json.data.entries);
          },
        )
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to search files",
          );
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPath, projectId, query]);

  const openFile = useCallback(
    async (entry: ProjectFileEntryInfo) => {
      if (!projectId) return;
      if (entry.isDir) {
        setViewer({ kind: "none" });
        setQuery("");
        await loadDirectory(entry.path);
        return;
      }

      if (isViewableAsset(entry.path)) {
        window.open(viewUrl(projectId, entry.path), "_blank", "noopener");
        return;
      }

      setViewer({ kind: "loading", path: entry.path });
      setError(null);

      try {
        const params = new URLSearchParams({ path: entry.path });
        const res = await fetch(
          `/api/projects/${projectId}/files/read?${params.toString()}`,
        );
        const json = (await res.json()) as
          | ApiResponse<ProjectFileReadResponse>
          | ApiError;
        if (!res.ok || !("data" in json)) {
          throw new Error("error" in json ? json.error : "Failed to read file");
        }

        if (json.data.isBinary || json.data.content == null) {
          setViewer({
            kind: "binary",
            path: json.data.path,
            size: json.data.size,
          });
          return;
        }

        if (json.data.size > MAX_INLINE_TEXT_BYTES) {
          setViewer({
            kind: "error",
            path: json.data.path,
            message: "File is too large to preview on mobile.",
          });
          return;
        }

        setViewer({
          kind: "text",
          path: json.data.path,
          content: json.data.content,
          size: json.data.size,
        });
      } catch (err) {
        setViewer({
          kind: "error",
          path: entry.path,
          message: err instanceof Error ? err.message : "Failed to read file",
        });
      }
    },
    [loadDirectory, projectId],
  );

  if (!projectId) {
    return (
      <section
        className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-5 text-sm text-neutral-500"
        data-testid="mobile-files-panel"
      >
        Select a project to browse files.
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid="mobile-files-panel">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium text-neutral-100">
              {projectName ?? "Project files"}
            </h2>
            <p className="mt-1 truncate text-xs text-neutral-500">
              /{currentPath || ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDirectory(currentPath)}
            className="min-h-9 rounded-md bg-neutral-800 px-3 text-xs font-medium text-neutral-300 active:bg-neutral-700"
          >
            Refresh
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files..."
          className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-border-focus"
        />

        <div className="mt-3 flex items-center gap-1 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => void loadDirectory("")}
            className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-neutral-300"
          >
            root
          </button>
          {pathCrumbs.map((crumb, index) => {
            const nextPath = pathCrumbs.slice(0, index + 1).join("/");
            return (
              <button
                key={nextPath}
                type="button"
                onClick={() => void loadDirectory(nextPath)}
                className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-neutral-400"
              >
                {crumb}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            {searching ? "Search results" : "Directory"}
          </span>
          <span className="text-xs text-neutral-500">
            {loading ? "Loading" : visibleEntries.length}
          </span>
        </div>

        {!searching && currentPath ? (
          <button
            type="button"
            onClick={() => void loadDirectory(parentPath(currentPath))}
            className="flex w-full items-center gap-3 border-b border-neutral-800 px-3 py-3 text-left text-sm text-neutral-300 active:bg-neutral-800"
          >
            <span className="w-6 text-center text-neutral-500">..</span>
            <span>Parent directory</span>
          </button>
        ) : null}

        {visibleEntries.length === 0 ? (
          <div className="px-3 py-5 text-sm text-neutral-500">
            {loading ? "Loading files..." : "No files to show."}
          </div>
        ) : (
          visibleEntries.map((entry) => (
            <button
              key={`${entry.isDir ? "dir" : "file"}:${entry.path}`}
              type="button"
              onClick={() => void openFile(entry)}
              className="flex w-full items-center gap-3 border-b border-neutral-800 px-3 py-3 text-left last:border-b-0 active:bg-neutral-800"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold ${
                  entry.isDir
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                    : "border-neutral-700 bg-neutral-950 text-neutral-400"
                }`}
              >
                {fileBadge(entry)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-neutral-100">
                  {searching ? entry.path : entry.name}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {entry.isDir ? "Folder" : formatSize(entry.size)}
                  {entry.isSymlink ? " · symlink" : ""}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {viewer.kind !== "none" ? (
        <div
          className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
          data-testid="mobile-file-viewer"
        >
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-100">
                {basename(viewer.path)}
              </div>
              <div className="truncate text-xs text-neutral-500">
                {viewer.path}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewer({ kind: "none" })}
              className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300"
            >
              Close
            </button>
          </div>
          {viewer.kind === "loading" ? (
            <div className="px-3 py-5 text-sm text-neutral-500">
              Loading preview...
            </div>
          ) : viewer.kind === "text" ? (
            <div className="max-h-[55vh] overflow-auto bg-[#0b1020]">
              <pre className="whitespace-pre-wrap break-words px-3 py-3 font-mono text-[12px] leading-5 text-neutral-200">
                {viewer.content}
              </pre>
            </div>
          ) : viewer.kind === "binary" ? (
            <div className="px-3 py-5 text-sm text-neutral-500">
              Binary file, {formatSize(viewer.size)}.
            </div>
          ) : (
            <div className="px-3 py-5 text-sm text-amber-200">
              {viewer.message}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
