"use client";

import { useState, useEffect, useCallback } from "react";
import type { BrowseResponse, ApiResponse } from "@/lib/types";

interface RemoteDirectoryPickerProps {
  sshConfigId: string;
  dockerContainer?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function RemoteDirectoryPicker({
  sshConfigId,
  dockerContainer,
  onSelect,
  onClose,
}: RemoteDirectoryPickerProps) {
  const [browse, setBrowse] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");

  const fetchDir = useCallback(
    async (path?: string) => {
      setLoading(true);
      setError(null);
      try {
        const base = `/api/ssh-configs/${sshConfigId}/browse`;
        const query = new URLSearchParams();
        if (path) query.set("path", path);
        if (dockerContainer) query.set("dockerContainer", dockerContainer);
        const url = query.size > 0 ? `${base}?${query.toString()}` : base;
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
        setError(
          err instanceof Error ? err.message : "Failed to browse remote directory",
        );
      } finally {
        setLoading(false);
      }
    },
    [sshConfigId, dockerContainer],
  );

  useEffect(() => {
    fetchDir();
  }, [fetchDir]);

  function handleGoTo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && pathInput.trim()) {
      fetchDir(pathInput.trim());
    }
  }

  if (!browse && !error) {
    return <div className="p-4 text-center text-sm text-neutral-500">Loading...</div>;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900">
      <div className="flex items-center gap-1 border-b border-neutral-800 p-2">
        <button
          type="button"
          onClick={() => fetchDir(dockerContainer ? "/" : "$HOME")}
          className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          {dockerContainer ? "Container Root" : "Home"}
        </button>
        <button
          type="button"
          onClick={() => fetchDir("/")}
          className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          /
        </button>
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={handleGoTo}
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
          placeholder={
            dockerContainer
              ? "Container path and press Enter"
              : "Remote path and press Enter"
          }
        />
      </div>

      {error && <div className="px-3 py-2 text-xs text-red-400">{error}</div>}

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
            <span className="truncate">{entry.name}</span>
          </button>
        ))}
      </div>

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
