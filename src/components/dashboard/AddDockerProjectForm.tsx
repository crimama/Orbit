"use client";

import { useEffect, useState } from "react";
import type {
  ApiError,
  ApiResponse,
  BrowseResponse,
  DockerContainerInfo,
  ProjectInfo,
  SshConfigInfo,
} from "@/lib/types";

interface AddDockerProjectFormProps {
  onCreated: (project: ProjectInfo) => void;
}

export default function AddDockerProjectForm({
  onCreated,
}: AddDockerProjectFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#14b8a6");
  const [connectionType, setConnectionType] = useState<"local" | "ssh">("local");
  const [sshConfigs, setSshConfigs] = useState<SshConfigInfo[]>([]);
  const [sshConfigId, setSshConfigId] = useState("");
  const [dockerContainer, setDockerContainer] = useState("");
  const [path, setPath] = useState("/");
  const [dirNavValue, setDirNavValue] = useState("");
  const [containers, setContainers] = useState<DockerContainerInfo[]>([]);
  const [browse, setBrowse] = useState<BrowseResponse | null>(null);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSshConfigs() {
      try {
        const res = await fetch("/api/ssh-configs");
        const json = (await res.json()) as ApiResponse<SshConfigInfo[]>;
        if (!cancelled && "data" in json) {
          setSshConfigs(json.data);
        }
      } catch {
        // Ignore SSH config fetch errors.
      }
    }

    async function fetchContainers() {
      setLoadingContainers(true);
      try {
        const url =
          connectionType === "ssh" && sshConfigId
            ? `/api/ssh-configs/${sshConfigId}/docker/containers`
            : "/api/docker/containers";
        const res = await fetch(url);
        const json = (await res.json()) as
          | ApiResponse<DockerContainerInfo[]>
          | ApiError;
        if (!cancelled && "data" in json) {
          setContainers(json.data);
        }
      } catch {
        // Keep manual input available even if list fetch fails.
      } finally {
        if (!cancelled) setLoadingContainers(false);
      }
    }

    fetchSshConfigs();
    fetchContainers();
    return () => {
      cancelled = true;
    };
  }, [connectionType, sshConfigId]);

  useEffect(() => {
    if (connectionType === "ssh" && !sshConfigId && sshConfigs.length > 0) {
      setSshConfigId(sshConfigs[0].id);
    }
  }, [connectionType, sshConfigId, sshConfigs]);

  async function fetchBrowseDirectories(nextPath?: string) {
    if (!dockerContainer.trim()) {
      setBrowse(null);
      return;
    }
    if (connectionType === "ssh" && !sshConfigId) {
      setBrowse(null);
      return;
    }

    setLoadingBrowse(true);
    try {
      const query = new URLSearchParams();
      if (nextPath) query.set("path", nextPath);
      let url = "";
      if (connectionType === "ssh") {
        query.set("dockerContainer", dockerContainer.trim());
        url = `/api/ssh-configs/${sshConfigId}/browse?${query.toString()}`;
      } else {
        query.set("container", dockerContainer.trim());
        url = `/api/docker/browse?${query.toString()}`;
      }
      const res = await fetch(url);
      const json = (await res.json()) as ApiResponse<BrowseResponse> | ApiError;
      if ("data" in json) {
        setBrowse(json.data);
        setPath(json.data.current);
      } else {
        setBrowse(null);
      }
    } catch {
      setBrowse(null);
    } finally {
      setLoadingBrowse(false);
    }
  }

  useEffect(() => {
    void fetchBrowseDirectories(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionType, sshConfigId, dockerContainer]);

  async function handlePathSelect(nextPath: string) {
    setPath(nextPath);
    await fetchBrowseDirectories(nextPath);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dockerContainer.trim() || !path.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: "DOCKER",
          color,
          path: path.trim(),
          dockerContainer: dockerContainer.trim(),
          sshConfigId: connectionType === "ssh" ? sshConfigId : undefined,
        }),
      });
      const json = (await res.json()) as ApiResponse<ProjectInfo> | ApiError;
      if ("error" in json) {
        setError(json.error);
        return;
      }
      onCreated(json.data);
      setName("");
      setColor("#14b8a6");
      setConnectionType("local");
      setSshConfigId("");
      setDockerContainer("");
      setPath("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create Docker project",
      );
    } finally {
      setLoading(false);
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

      <div className="space-y-1">
        <label className="text-xs text-neutral-500">Connection</label>
        <div className="flex gap-2 text-xs text-neutral-400">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              value="local"
              checked={connectionType === "local"}
              onChange={() => {
                setConnectionType("local");
                setDockerContainer("");
                setContainers([]);
                setBrowse(null);
                setPath("/");
                setDirNavValue("");
              }}
            />
            Local Docker
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              value="ssh"
              checked={connectionType === "ssh"}
              onChange={() => {
                setConnectionType("ssh");
                setDockerContainer("");
                setContainers([]);
                setBrowse(null);
                setPath("/");
                setDirNavValue("");
              }}
            />
            SSH Host
          </label>
        </div>
      </div>

      {connectionType === "ssh" && (
        <select
          value={sshConfigId}
          onChange={(e) => {
            setSshConfigId(e.target.value);
            setDockerContainer("");
            setContainers([]);
            setBrowse(null);
            setPath("/");
            setDirNavValue("");
          }}
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:border-neutral-500 focus:outline-none"
        >
          {sshConfigs.length === 0 ? (
            <option value="">No registered SSH hosts</option>
          ) : (
            sshConfigs.map((cfg) => (
              <option key={cfg.id} value={cfg.id}>
                {cfg.label?.trim() || `${cfg.username}@${cfg.host}:${cfg.port}`}
              </option>
            ))
          )}
        </select>
      )}

      <input
        type="text"
        placeholder={
          connectionType === "ssh"
            ? "Remote container name or ID"
            : "Container name or ID"
        }
        value={dockerContainer}
        onChange={(e) => {
          setDockerContainer(e.target.value);
          setBrowse(null);
          setDirNavValue("");
        }}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
      />

      <select
        value=""
        onChange={(e) => {
          if (e.target.value) {
            setDockerContainer(e.target.value);
            setBrowse(null);
            setDirNavValue("");
          }
        }}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:border-neutral-500 focus:outline-none"
        disabled={loadingContainers || containers.length === 0}
      >
        <option value="">
          {loadingContainers
            ? "Loading running containers..."
            : containers.length > 0
              ? connectionType === "ssh"
                ? "Pick from remote running containers (optional)"
                : "Pick from running containers (optional)"
              : connectionType === "ssh"
                ? "No running containers found on selected SSH host"
                : "No running containers found"}
        </option>
        {containers.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name} ({c.id.slice(0, 12)})
          </option>
        ))}
      </select>

      <select
        value={dirNavValue}
        onChange={(e) => {
          const value = e.target.value;
          setDirNavValue("");
          if (value) void handlePathSelect(value);
        }}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        disabled={!dockerContainer.trim() || loadingBrowse || !browse}
      >
        {!dockerContainer.trim() ? (
          <option value="">Select container first</option>
        ) : loadingBrowse ? (
          <option value="">Loading directories...</option>
        ) : !browse ? (
          <option value="">No directories loaded (choose another container)</option>
        ) : (
          <>
            <option value="">Current: {browse.current}</option>
            {browse.parent && <option value={browse.parent}>.. (Parent)</option>}
            {browse.entries.map((entry) => (
              <option key={entry.path} value={entry.path}>
                {entry.name}
              </option>
            ))}
          </>
        )}
      </select>

      <input
        type="text"
        placeholder="Workdir in container (e.g. /app)"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void fetchBrowseDirectories(path.trim() || "/");
          }
        }}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => void fetchBrowseDirectories(path.trim() || "/")}
        disabled={!dockerContainer.trim() || loadingBrowse}
        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
      >
        {loadingBrowse ? "Loading..." : "Load Directory"}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={
          loading ||
          !name.trim() ||
          !dockerContainer.trim() ||
          !path.trim() ||
          (connectionType === "ssh" && !sshConfigId)
        }
        className="w-full rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Add Docker Project"}
      </button>
    </form>
  );
}
