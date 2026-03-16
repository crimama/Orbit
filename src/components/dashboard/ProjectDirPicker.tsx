"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  ApiResponse,
  ProjectFileListResponse,
  ProjectInfo,
} from "@/lib/types";

interface ProjectDirPickerProps {
  projectId: string;
  title: string;
  defaultName?: string;
  onSelect: (destPath: string, destProjectId: string) => void;
  onClose: () => void;
}

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export default function ProjectDirPicker({
  projectId,
  title,
  defaultName = "",
  onSelect,
  onClose,
}: ProjectDirPickerProps) {
  const [activeProjectId, setActiveProjectId] = useState(projectId);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [currentDir, setCurrentDir] = useState("");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Fetch all projects on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse<ProjectInfo[]>;
        if ("data" in json && !cancelled) {
          setProjects(json.data);
        }
      } catch {
        // ignore — picker still works with current project
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchDir = useCallback(
    async (pid: string, dir: string) => {
      setLoading(true);
      setError(null);
      try {
        const query = dir
          ? new URLSearchParams({ path: dir }).toString()
          : "";
        const url = `/api/projects/${pid}/files/list${query ? `?${query}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to list directory");
        const json = (await res.json()) as ApiResponse<ProjectFileListResponse>;
        if (!("data" in json)) throw new Error("Invalid response");
        const dirs = json.data.entries
          .filter((e) => e.isDir)
          .map((e) => ({ name: e.name, path: e.path, isDir: true }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setEntries(dirs);
        setCurrentDir(json.data.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to browse");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load root when project changes
  useEffect(() => {
    setCurrentDir("");
    setEntries([]);
    void fetchDir(activeProjectId, "");
  }, [activeProjectId, fetchDir]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goUp = useCallback(() => {
    if (!currentDir) return;
    const parts = currentDir.split("/").filter(Boolean);
    parts.pop();
    void fetchDir(activeProjectId, parts.join("/"));
  }, [activeProjectId, currentDir, fetchDir]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const dest = currentDir ? `${currentDir}/${trimmed}` : trimmed;
    onSelect(dest, activeProjectId);
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const dirLabel = currentDir || "/";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="flex w-[380px] max-h-[75vh] flex-col rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Project selector */}
        {projects.length > 1 && (
          <div className="border-b border-neutral-800 px-4 py-2">
            <label className="mb-1 block text-[11px] text-neutral-500">
              Project
            </label>
            <select
              value={activeProjectId}
              onChange={(e) => setActiveProjectId(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-sky-600"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.id === projectId ? "(current)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current path */}
        <div className="border-b border-neutral-800 px-4 py-2">
          <p className="text-[11px] text-neutral-500">
            Destination{activeProject && activeProjectId !== projectId ? ` in ${activeProject.name}` : ""}
          </p>
          <p className="truncate text-xs font-mono text-neutral-300">
            {dirLabel}
          </p>
        </div>

        {/* Directory list */}
        <div className="min-h-[120px] max-h-[40vh] flex-1 overflow-y-auto px-2 py-1">
          {currentDir && (
            <button
              type="button"
              onClick={goUp}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <span className="w-4 shrink-0 text-center">↩</span>
              <span>..</span>
            </button>
          )}
          {loading ? (
            <p className="px-2 py-3 text-center text-xs text-neutral-500">
              Loading...
            </p>
          ) : entries.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-neutral-500">
              No subdirectories
            </p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => void fetchDir(activeProjectId, entry.path)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-amber-300/90 hover:bg-neutral-800"
                title={entry.path}
              >
                <span className="w-4 shrink-0 text-center text-[11px] text-neutral-500">
                  📂
                </span>
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="text-[10px] text-neutral-600">›</span>
              </button>
            ))
          )}
        </div>

        {error ? (
          <div className="border-t border-red-900 bg-red-950/50 px-3 py-1.5 text-[11px] text-red-400">
            {error}
          </div>
        ) : null}

        {/* Name input + Confirm */}
        <div className="border-t border-neutral-800 px-4 py-3">
          <label className="mb-1.5 block text-[11px] text-neutral-500">
            File / folder name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
            className="mb-3 w-full rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-sky-600"
            autoFocus
            placeholder="name"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!name.trim()}
              className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-40"
              type="button"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
