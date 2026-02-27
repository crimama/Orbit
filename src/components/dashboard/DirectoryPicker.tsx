"use client";

import { useState, useEffect, useCallback } from "react";
import type { BrowseResponse, ApiResponse } from "@/lib/types";

interface DirectoryPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function DirectoryPicker({
  onSelect,
  onClose,
}: DirectoryPickerProps) {
  const [browse, setBrowse] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");

  const fetchDir = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = path
        ? `/api/filesystem?path=${encodeURIComponent(path)}`
        : "/api/filesystem";
      const res = await fetch(url);
      const json = (await res.json()) as
        | ApiResponse<BrowseResponse>
        | { error: string };
      if ("error" in json) {
        setError(json.error);
      } else {
        setBrowse(json.data);
        setPathInput(json.data.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to browse");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDir();
  }, [fetchDir]);

  function handleGoTo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && pathInput.trim()) {
      fetchDir(pathInput.trim());
    }
  }

  if (!browse && !error) {
    return (
      <div className="p-4 text-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900">
      {/* Path input */}
      <div className="flex items-center gap-1 border-b border-neutral-800 p-2">
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={handleGoTo}
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
          placeholder="Enter path and press Enter"
        />
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      {/* Directory list */}
      <div className="max-h-48 overflow-y-auto">
        {browse?.parent && (
          <button
            onClick={() => fetchDir(browse.parent!)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-800"
          >
            <span className="text-neutral-600">..</span>
            <span className="text-xs text-neutral-600">parent</span>
          </button>
        )}
        {browse?.entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => fetchDir(entry.path)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0 text-neutral-500"
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
            <span className="truncate">{entry.name}</span>
          </button>
        ))}
        {browse?.entries.length === 0 && (
          <div className="px-3 py-3 text-center text-xs text-neutral-600">
            No subdirectories
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-neutral-800 p-2">
        <span className="truncate font-mono text-xs text-neutral-500">
          {browse?.current}
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={() => browse && onSelect(browse.current)}
            disabled={loading || !browse}
            className="rounded bg-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-600 disabled:opacity-50"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
