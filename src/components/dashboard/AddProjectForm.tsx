"use client";

import { useState } from "react";
import DirectoryPicker from "./DirectoryPicker";
import type { ProjectInfo, ApiResponse, ApiError } from "@/lib/types";

interface AddProjectFormProps {
  onCreated: (project: ProjectInfo) => void;
}

export default function AddProjectForm({ onCreated }: AddProjectFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: "LOCAL",
          color,
          path: path.trim(),
        }),
      });
      const json = (await res.json()) as ApiResponse<ProjectInfo> | ApiError;

      if ("error" in json) {
        setError(json.error);
      } else {
        onCreated(json.data);
        setName("");
        setColor("#3b82f6");
        setPath("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create project",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDirectorySelect(selectedPath: string) {
    setPath(selectedPath);
    setShowPicker(false);
    // Auto-fill name from directory name if empty
    if (!name.trim()) {
      const dirName = selectedPath.split("/").filter(Boolean).pop();
      if (dirName) setName(dirName);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3">
      <input
        type="text"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-neutral-700 bg-neutral-900 p-0.5"
        />
        <code className="text-xs text-neutral-500">{color}</code>
      </div>

      <div className="flex gap-1">
        <input
          type="text"
          placeholder="/path/to/project"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="shrink-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          title="Browse directories"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </button>
      </div>

      {showPicker && (
        <DirectoryPicker
          onSelect={handleDirectorySelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading || !name.trim() || !path.trim()}
        className="w-full rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Add Project"}
      </button>
    </form>
  );
}
