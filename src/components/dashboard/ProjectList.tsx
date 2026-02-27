"use client";

import { useState, useRef, useEffect } from "react";
import DirectoryPicker from "./DirectoryPicker";
import RemoteDirectoryPicker from "./RemoteDirectoryPicker";
import type {
  ApiError,
  ApiResponse,
  BrowseResponse,
  DockerContainerInfo,
  ProjectInfo,
} from "@/lib/types";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#a3a3a3",
];

interface ProjectListProps {
  projects: ProjectInfo[];
  selectedId: string | null;
  onSelect: (project: ProjectInfo) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onUpdateConfig: (
    id: string,
    update: { path: string; dockerContainer?: string | null },
  ) => void;
  onChangeColor: (id: string, color: string) => void;
}

export default function ProjectList({
  projects,
  selectedId,
  onSelect,
  onDelete,
  onRename,
  onUpdateConfig,
  onChangeColor,
}: ProjectListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [configEditingId, setConfigEditingId] = useState<string | null>(null);
  const [editPathValue, setEditPathValue] = useState("");
  const [editContainerValue, setEditContainerValue] = useState("");
  const [configContainers, setConfigContainers] = useState<DockerContainerInfo[]>([]);
  const [loadingConfigContainers, setLoadingConfigContainers] = useState(false);
  const [configBrowse, setConfigBrowse] = useState<BrowseResponse | null>(null);
  const [loadingConfigBrowse, setLoadingConfigBrowse] = useState(false);
  const [dirNavValue, setDirNavValue] = useState("");
  const [showLocalPickerForId, setShowLocalPickerForId] = useState<string | null>(
    null,
  );
  const [showRemotePickerForId, setShowRemotePickerForId] = useState<string | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerId) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColorPickerId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [colorPickerId]);

  function startEditing(p: ProjectInfo) {
    setEditingId(p.id);
    setEditValue(p.name);
  }

  function commitEdit() {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== projects.find((p) => p.id === editingId)?.name) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function startConfigEditing(p: ProjectInfo) {
    setConfigEditingId(p.id);
    setEditPathValue(p.path);
    setEditContainerValue(p.dockerContainer ?? "");
    setConfigContainers([]);
    setConfigBrowse(null);
    setDirNavValue("");
    setShowLocalPickerForId(null);
    setShowRemotePickerForId(null);
  }

  function commitConfigEdit(project: ProjectInfo) {
    const nextPath = editPathValue.trim();
    const nextContainer = editContainerValue.trim();
    if (!nextPath) return;
    const changedPath = nextPath !== project.path;
    const changedContainer =
      (project.dockerContainer ?? "") !== nextContainer &&
      (project.type === "DOCKER" || project.dockerContainer);
    if (changedPath || changedContainer) {
      onUpdateConfig(project.id, {
        path: nextPath,
        dockerContainer:
          project.type === "DOCKER" || project.dockerContainer
            ? nextContainer || null
            : undefined,
      });
    }
    setConfigEditingId(null);
    setShowLocalPickerForId(null);
    setShowRemotePickerForId(null);
  }

  const configProject = configEditingId
    ? projects.find((project) => project.id === configEditingId) ?? null
    : null;
  const configProjectHasContainer =
    configProject?.type === "DOCKER" || Boolean(configProject?.dockerContainer);

  useEffect(() => {
    if (!configProject || !configProjectHasContainer) return;
    const currentProject = configProject;
    let cancelled = false;

    async function fetchContainers() {
      setLoadingConfigContainers(true);
      try {
        const url = currentProject.sshConfigId
          ? `/api/ssh-configs/${currentProject.sshConfigId}/docker/containers`
          : "/api/docker/containers";
        const res = await fetch(url);
        const json = (await res.json()) as
          | ApiResponse<DockerContainerInfo[]>
          | ApiError;
        if (!cancelled) {
          if ("data" in json) {
            setConfigContainers(json.data);
          } else {
            setConfigContainers([]);
          }
        }
      } catch {
        if (!cancelled) setConfigContainers([]);
      } finally {
        if (!cancelled) setLoadingConfigContainers(false);
      }
    }

    void fetchContainers();
    return () => {
      cancelled = true;
    };
  }, [configProject, configProjectHasContainer]);

  async function fetchConfigBrowse(project: ProjectInfo, nextPath?: string) {
    if (!(project.type === "DOCKER" || project.dockerContainer)) return;
    if (!editContainerValue.trim()) {
      setConfigBrowse(null);
      return;
    }

    setLoadingConfigBrowse(true);
    try {
      const query = new URLSearchParams();
      if (nextPath) query.set("path", nextPath);
      let url = "";
      if (project.sshConfigId) {
        query.set("dockerContainer", editContainerValue.trim());
        url = `/api/ssh-configs/${project.sshConfigId}/browse?${query.toString()}`;
      } else {
        query.set("container", editContainerValue.trim());
        url = `/api/docker/browse?${query.toString()}`;
      }

      const res = await fetch(url);
      const json = (await res.json()) as ApiResponse<BrowseResponse> | ApiError;
      if ("data" in json) {
        setConfigBrowse(json.data);
        setEditPathValue(json.data.current);
      } else {
        setConfigBrowse(null);
      }
    } catch {
      setConfigBrowse(null);
    } finally {
      setLoadingConfigBrowse(false);
    }
  }

  useEffect(() => {
    if (!configProject || !configProjectHasContainer) return;
    void fetchConfigBrowse(configProject, editPathValue || "/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configProject?.id, configProject?.sshConfigId, editContainerValue]);

  if (projects.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-neutral-500">
        No projects yet. Add one to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {projects.map((p) => {
        const isSelected = selectedId === p.id;
        return (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            className={`group relative cursor-pointer rounded-lg py-2 pl-5 pr-3 transition-colors ${
              isSelected ? "text-neutral-100" : "text-neutral-300"
            }`}
            style={{
              backgroundColor: isSelected ? `${p.color}20` : undefined,
              borderLeft: `3px solid ${p.color}`,
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = `${p.color}10`;
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = "";
            }}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* Color dot — click to open picker */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColorPickerId(colorPickerId === p.id ? null : p.id);
                      }}
                      className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20 transition-transform hover:scale-125"
                      style={{ backgroundColor: p.color }}
                      title="Change color"
                    />
                    {colorPickerId === p.id && (
                      <div
                        ref={pickerRef}
                        className="absolute left-0 top-full z-50 mt-2 grid grid-cols-5 gap-2 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              onChangeColor(p.id, c);
                              setColorPickerId(null);
                            }}
                            className={`h-5 w-5 rounded-full border border-black/30 transition-transform hover:scale-110 ${
                              c === p.color
                                ? "outline outline-2 outline-white"
                                : "outline-none"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {editingId === p.id ? (
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 text-sm font-medium text-neutral-100 outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div
                      className="truncate text-sm font-medium"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditing(p);
                      }}
                    >
                      {p.name}
                    </div>
                  )}
                </div>
                <div className="ml-5 truncate text-xs text-neutral-500">
                  {(p.type === "DOCKER" || p.type === "SSH") && p.dockerContainer
                    ? `${p.dockerContainer}:${p.path}`
                    : p.path}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    color: `${p.color}cc`,
                    backgroundColor: `${p.color}15`,
                    border: `1px solid ${p.color}30`,
                  }}
                >
                  {p.type}
                </span>
                <span className="text-xs text-neutral-600">
                  {p.sessionCount}
                </span>
                {/* Rename button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startConfigEditing(p);
                  }}
                  className="hidden rounded p-1 text-neutral-600 hover:bg-neutral-700 hover:text-neutral-300 group-hover:block"
                  title="Edit project config"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                    />
                  </svg>
                </button>
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p.id);
                  }}
                  className="hidden rounded p-1 text-neutral-600 hover:bg-neutral-700 hover:text-red-400 group-hover:block"
                  title="Delete"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            {configEditingId === p.id && (
              <div
                className="ml-5 mt-2 space-y-1 rounded border border-neutral-800 bg-neutral-900/80 p-2"
                onClick={(e) => e.stopPropagation()}
              >
                  <input
                    type="text"
                    value={editPathValue}
                  onChange={(e) => setEditPathValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (p.type === "DOCKER" || p.dockerContainer) &&
                      editContainerValue.trim()
                    ) {
                      e.preventDefault();
                      void fetchConfigBrowse(p, editPathValue.trim() || "/");
                    }
                  }}
                    placeholder="Project path"
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                  />
                  <div className="flex gap-1">
                    {p.type === "LOCAL" && (
                      <button
                        type="button"
                        onClick={() => setShowLocalPickerForId(p.id)}
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                      >
                        Browse
                      </button>
                    )}
                    {p.type !== "LOCAL" && p.sshConfigId && (
                      <button
                        type="button"
                        onClick={() => setShowRemotePickerForId(p.id)}
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                        disabled={Boolean(
                          (p.type === "DOCKER" || p.dockerContainer) &&
                            !editContainerValue.trim(),
                        )}
                      >
                        Browse
                      </button>
                    )}
                  </div>
                {(p.type === "DOCKER" || p.dockerContainer) && (
                  <>
                    <input
                      type="text"
                      value={editContainerValue}
                      onChange={(e) => {
                        setEditContainerValue(e.target.value);
                        setConfigBrowse(null);
                        setDirNavValue("");
                      }}
                      placeholder="Container name"
                      className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                    />
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setEditContainerValue(e.target.value);
                        setConfigBrowse(null);
                        setDirNavValue("");
                      }}
                      className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none"
                      disabled={loadingConfigContainers || configContainers.length === 0}
                    >
                      <option value="">
                        {loadingConfigContainers
                          ? "Loading containers..."
                          : configContainers.length > 0
                            ? "Pick container (optional)"
                            : "No containers found"}
                      </option>
                      {configContainers.map((c) => (
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
                        if (value) void fetchConfigBrowse(p, value);
                      }}
                      className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
                      disabled={!editContainerValue.trim() || loadingConfigBrowse || !configBrowse}
                    >
                      {!editContainerValue.trim() ? (
                        <option value="">Select container first</option>
                      ) : loadingConfigBrowse ? (
                        <option value="">Loading directories...</option>
                      ) : !configBrowse ? (
                        <option value="">No directories loaded</option>
                      ) : (
                        <>
                          <option value="">Current: {configBrowse.current}</option>
                          {configBrowse.parent && (
                            <option value={configBrowse.parent}>.. (Parent)</option>
                          )}
                          {configBrowse.entries.map((entry) => (
                            <option key={entry.path} value={entry.path}>
                              {entry.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <button
                      onClick={() =>
                        void fetchConfigBrowse(p, editPathValue.trim() || "/")
                      }
                      disabled={!editContainerValue.trim() || loadingConfigBrowse}
                      className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {loadingConfigBrowse ? "Loading..." : "Load Directory"}
                    </button>
                  </>
                )}
                {showLocalPickerForId === p.id && (
                  <DirectoryPicker
                    onSelect={(selectedPath) => {
                      setEditPathValue(selectedPath);
                      setShowLocalPickerForId(null);
                    }}
                    onClose={() => setShowLocalPickerForId(null)}
                  />
                )}
                {showRemotePickerForId === p.id && p.sshConfigId && (
                  <RemoteDirectoryPicker
                    sshConfigId={p.sshConfigId}
                    dockerContainer={
                      (p.type === "DOCKER" || p.dockerContainer) &&
                      editContainerValue.trim()
                        ? editContainerValue.trim()
                        : undefined
                    }
                    onSelect={(selectedPath) => {
                      setEditPathValue(selectedPath);
                      setShowRemotePickerForId(null);
                    }}
                    onClose={() => setShowRemotePickerForId(null)}
                  />
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => commitConfigEdit(p)}
                    disabled={
                      !editPathValue.trim() ||
                      (p.type === "DOCKER" && !editContainerValue.trim())
                    }
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setConfigEditingId(null)}
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
