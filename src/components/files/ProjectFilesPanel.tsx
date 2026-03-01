"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createLeaf,
  splitPane,
  closePane,
  updateLeafSession,
  updateSplitRatio,
  findLeaf,
  collectLeafIds,
  type PaneNode,
} from "@/lib/paneTree";
import { PROJECT_FILES_MAX_EDIT_BYTES } from "@/lib/constants";
import type {
  ApiError,
  ApiResponse,
  ProjectFileEntryInfo,
  ProjectFileListResponse,
  ProjectFileReadResponse,
  ProjectFileWriteResponse,
} from "@/lib/types";
import SplitDivider from "@/components/terminal/SplitDivider";
import CodeEditor, { languageFromPath } from "./CodeEditor";

type FileDoc = {
  path: string;
  content: string;
  originalContent: string;
  mtimeMs: number;
  size: number;
  isBinary: boolean;
};

interface ProjectFilesPanelProps {
  projectId: string;
}

function parentPath(value: string): string {
  if (!value) return "";
  const parts = value.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

type RendererProps = {
  node: PaneNode;
  activePaneId: string;
  docs: Record<string, FileDoc>;
  busyPath: string | null;
  onActivate: (paneId: string) => void;
  onSplit: (paneId: string, direction: "horizontal" | "vertical") => void;
  onClose: (paneId: string) => void;
  onSelectDoc: (paneId: string, filePath: string) => void;
  onDocChange: (filePath: string, content: string) => void;
  onSaveDoc: (filePath: string) => void;
  onRatioChange: (splitId: string, ratio: number) => void;
};

function FilePaneRenderer({
  node,
  activePaneId,
  docs,
  busyPath,
  onActivate,
  onSplit,
  onClose,
  onSelectDoc,
  onDocChange,
  onSaveDoc,
  onRatioChange,
}: RendererProps) {
  if (node.type === "leaf") {
    const filePath = node.sessionId;
    const doc = filePath ? docs[filePath] : null;
    const dirty = Boolean(doc && doc.content !== doc.originalContent);

    return (
      <div
        className={`flex h-full w-full flex-col rounded-2xl border border-slate-300 bg-white ${
          node.id === activePaneId ? "ring-1 ring-inset ring-sky-300" : ""
        }`}
        onClick={() => onActivate(node.id)}
      >
        <div className="flex min-w-0 flex-shrink-0 items-center gap-1.5 border-b bg-slate-100/90 px-2.5 py-1.5">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">
            File
          </span>
          <select
            value={filePath ?? ""}
            onChange={(e) => {
              if (e.target.value) onSelectDoc(node.id, e.target.value);
            }}
            className="min-w-0 flex-1 truncate rounded-full border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-900 outline-none focus:border-sky-400"
          >
            <option value="">Select file...</option>
            {Object.keys(docs)
              .sort()
              .map((pathKey) => (
                <option key={pathKey} value={pathKey}>
                  {pathKey}
                </option>
              ))}
          </select>
          {doc ? (
            <span
              className={`hidden rounded-full px-1.5 py-0.5 text-xs sm:inline ${
                dirty
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {dirty ? "Modified" : "Saved"}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSplit(node.id, "horizontal");
              }}
              title="Split Horizontal"
              className="rounded px-1.5 py-0.5 text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            >
              ⎸
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSplit(node.id, "vertical");
              }}
              title="Split Vertical"
              className="rounded px-1.5 py-0.5 text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            >
              ⎯
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (filePath) onSaveDoc(filePath);
              }}
              disabled={!filePath || busyPath === filePath || !dirty}
              title="Save"
              className="rounded px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(node.id);
              }}
              title="Close Pane"
              className="rounded px-1.5 py-0.5 text-sm text-slate-500 hover:bg-red-100 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {!doc ? (
            <div className="flex h-full items-center justify-center bg-slate-100">
              <p className="text-base font-medium text-slate-600">
                Select a file
              </p>
            </div>
          ) : doc.isBinary ? (
            <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-600">
              Binary file is not editable.
            </div>
          ) : doc.size > PROJECT_FILES_MAX_EDIT_BYTES ? (
            <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-600">
              File is larger than editor limit.
            </div>
          ) : (
            <CodeEditor
              value={doc.content}
              onChange={(value) => onDocChange(doc.path, value)}
              languageId={languageFromPath(doc.path)}
              readOnly={busyPath === doc.path}
              height="100%"
            />
          )}
        </div>
      </div>
    );
  }

  const isHorizontal = node.direction === "horizontal";
  const firstPercent = `${node.ratio * 100}%`;
  const secondPercent = `${(1 - node.ratio) * 100}%`;

  return (
    <div
      className={`flex h-full w-full ${isHorizontal ? "flex-row" : "flex-col"}`}
    >
      <div
        style={{ flexBasis: firstPercent }}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <FilePaneRenderer
          node={node.children[0]}
          activePaneId={activePaneId}
          docs={docs}
          busyPath={busyPath}
          onActivate={onActivate}
          onSplit={onSplit}
          onClose={onClose}
          onSelectDoc={onSelectDoc}
          onDocChange={onDocChange}
          onSaveDoc={onSaveDoc}
          onRatioChange={onRatioChange}
        />
      </div>
      <SplitDivider
        direction={node.direction}
        onRatioChange={(ratio) => onRatioChange(node.id, ratio)}
      />
      <div
        style={{ flexBasis: secondPercent }}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <FilePaneRenderer
          node={node.children[1]}
          activePaneId={activePaneId}
          docs={docs}
          busyPath={busyPath}
          onActivate={onActivate}
          onSplit={onSplit}
          onClose={onClose}
          onSelectDoc={onSelectDoc}
          onDocChange={onDocChange}
          onSaveDoc={onSaveDoc}
          onRatioChange={onRatioChange}
        />
      </div>
    </div>
  );
}

export default function ProjectFilesPanel({
  projectId,
}: ProjectFilesPanelProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<ProjectFileEntryInfo[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, FileDoc>>({});
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [tree, setTree] = useState<PaneNode>(() => createLeaf(null));
  const [activePaneId, setActivePaneId] = useState(tree.id);
  const activePaneIdRef = useRef(activePaneId);

  useEffect(() => {
    activePaneIdRef.current = activePaneId;
  }, [activePaneId]);

  const refreshList = useCallback(
    async (pathToLoad: string) => {
      setLoadingList(true);
      setError(null);
      try {
        const query = new URLSearchParams({ path: pathToLoad }).toString();
        const res = await fetch(
          `/api/projects/${projectId}/files/list?${query}`,
          {
            cache: "no-store",
          },
        );
        const json = (await res.json()) as
          | ApiResponse<ProjectFileListResponse>
          | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error(
            "error" in json ? json.error : "Failed to list files",
          );
        }
        setCurrentPath(json.data.current);
        setEntries(json.data.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to list files");
      } finally {
        setLoadingList(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    setDocs({});
    const root = createLeaf(null);
    setTree(root);
    setActivePaneId(root.id);
    void refreshList("");
  }, [projectId, refreshList]);

  const openFile = useCallback(
    async (filePath: string, paneId?: string) => {
      const targetPaneId = paneId ?? activePaneIdRef.current;
      setBusyPath(filePath);
      setError(null);
      try {
        const query = new URLSearchParams({ path: filePath }).toString();
        const res = await fetch(
          `/api/projects/${projectId}/files/read?${query}`,
          {
            cache: "no-store",
          },
        );
        const json = (await res.json()) as
          | ApiResponse<ProjectFileReadResponse>
          | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Failed to open file");
        }
        const data = json.data;
        const content = data.content ?? "";
        setDocs((prev) => ({
          ...prev,
          [data.path]: {
            path: data.path,
            content,
            originalContent: content,
            mtimeMs: data.mtimeMs,
            size: data.size,
            isBinary: data.isBinary,
          },
        }));
        setTree((prev) => updateLeafSession(prev, targetPaneId, data.path));
        setActivePaneId(targetPaneId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open file");
      } finally {
        setBusyPath(null);
      }
    },
    [projectId],
  );

  const saveDoc = useCallback(
    async (filePath: string) => {
      const doc = docs[filePath];
      if (!doc) return;
      setBusyPath(filePath);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/files/write?${new URLSearchParams({ path: filePath }).toString()}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              content: doc.content,
              expectedMtimeMs: doc.mtimeMs,
            }),
          },
        );
        const json = (await res.json()) as
          | ApiResponse<ProjectFileWriteResponse>
          | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Failed to save file");
        }
        setDocs((prev) => ({
          ...prev,
          [filePath]: {
            ...prev[filePath],
            originalContent: prev[filePath].content,
            mtimeMs: json.data.mtimeMs,
            size: json.data.size,
          },
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save file");
      } finally {
        setBusyPath(null);
      }
    },
    [docs, projectId],
  );

  const createFile = useCallback(async () => {
    const name = window.prompt("New file name", "untitled.txt")?.trim();
    if (!name) return;
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    setBusyPath(fullPath);
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
      const json = (await res.json()) as
        | ApiResponse<ProjectFileWriteResponse>
        | ApiError;
      if (!res.ok || "error" in json) {
        throw new Error("error" in json ? json.error : "Failed to create file");
      }
      await refreshList(currentPath);
      await openFile(fullPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create file");
    } finally {
      setBusyPath(null);
    }
  }, [currentPath, openFile, projectId, refreshList]);

  const createFolder = useCallback(async () => {
    const name = window.prompt("New folder name", "new-folder")?.trim();
    if (!name) return;
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    setBusyPath(fullPath);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/mkdir`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: fullPath }),
      });
      const json = (await res.json()) as ApiResponse<{ ok: true }> | ApiError;
      if (!res.ok || "error" in json) {
        throw new Error(
          "error" in json ? json.error : "Failed to create folder",
        );
      }
      await refreshList(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setBusyPath(null);
    }
  }, [currentPath, projectId, refreshList]);

  const renameEntry = useCallback(
    async (entry: ProjectFileEntryInfo) => {
      const nextName = window.prompt("Rename", entry.name)?.trim();
      if (!nextName || nextName === entry.name) return;
      const toPath = parentPath(entry.path)
        ? `${parentPath(entry.path)}/${nextName}`
        : nextName;
      setBusyPath(entry.path);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/files/rename`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from: entry.path, to: toPath }),
        });
        const json = (await res.json()) as ApiResponse<{ ok: true }> | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Failed to rename");
        }

        setDocs((prev) => {
          if (!prev[entry.path]) return prev;
          const next = { ...prev };
          const existing = next[entry.path];
          delete next[entry.path];
          next[toPath] = { ...existing, path: toPath };
          return next;
        });
        setTree((prev) => {
          const leafIds = collectLeafIds(prev);
          let nextTree = prev;
          for (const leafId of leafIds) {
            const leaf = findLeaf(nextTree, leafId);
            if (leaf?.sessionId === entry.path) {
              nextTree = updateLeafSession(nextTree, leafId, toPath);
            }
          }
          return nextTree;
        });
        await refreshList(currentPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename");
      } finally {
        setBusyPath(null);
      }
    },
    [currentPath, projectId, refreshList],
  );

  const deleteEntry = useCallback(
    async (entry: ProjectFileEntryInfo) => {
      const confirmed = window.confirm(
        entry.isDir
          ? `Delete folder ${entry.name}? (recursive)`
          : `Delete file ${entry.name}?`,
      );
      if (!confirmed) return;
      setBusyPath(entry.path);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/files/delete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: entry.path, recursive: entry.isDir }),
        });
        const json = (await res.json()) as ApiResponse<{ ok: true }> | ApiError;
        if (!res.ok || "error" in json) {
          throw new Error("error" in json ? json.error : "Failed to delete");
        }
        setDocs((prev) => {
          const next = { ...prev };
          delete next[entry.path];
          return next;
        });
        setTree((prev) => {
          const leafIds = collectLeafIds(prev);
          let nextTree = prev;
          for (const leafId of leafIds) {
            const leaf = findLeaf(nextTree, leafId);
            if (leaf?.sessionId === entry.path) {
              nextTree = updateLeafSession(nextTree, leafId, null);
            }
          }
          return nextTree;
        });
        await refreshList(currentPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      } finally {
        setBusyPath(null);
      }
    },
    [currentPath, projectId, refreshList],
  );

  const splitActivePane = useCallback(
    (paneId: string, direction: "horizontal" | "vertical") => {
      setTree((prev) => splitPane(prev, paneId, direction, null));
    },
    [],
  );

  const updatePaneRatio = useCallback((splitId: string, ratio: number) => {
    setTree((prev) => updateSplitRatio(prev, splitId, ratio));
  }, []);

  const closeEditorPane = useCallback(
    (paneId: string) => {
      const leaf = findLeaf(tree, paneId);
      const filePath = leaf?.sessionId;
      const doc = filePath ? docs[filePath] : null;
      const hasUnsavedChanges = Boolean(
        doc && doc.content !== doc.originalContent,
      );

      if (hasUnsavedChanges) {
        const confirmClose = window.confirm(
          `Close pane with unsaved changes in ${filePath}?`,
        );
        if (!confirmClose) return;
      }

      setTree((prev) => {
        const next = closePane(prev, paneId);
        if (!next) {
          const replacement = createLeaf(null);
          setActivePaneId(replacement.id);
          return replacement;
        }

        if (activePaneId === paneId) {
          const firstLeaf = findFirstLeaf(next);
          if (firstLeaf) {
            setActivePaneId(firstLeaf.id);
          }
        }

        return next;
      });
    },
    [activePaneId, docs, tree],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        const activeLeaf = findLeaf(tree, activePaneIdRef.current);
        if (activeLeaf?.sessionId) {
          void saveDoc(activeLeaf.sessionId);
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        Boolean(target?.isContentEditable);
      if (isEditable) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "w") {
        event.preventDefault();
        closeEditorPane(activePaneIdRef.current);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        const direction = event.shiftKey ? "horizontal" : "vertical";
        splitActivePane(activePaneIdRef.current, direction);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeEditorPane, saveDoc, splitActivePane, tree]);

  const docsMap = useMemo(() => docs, [docs]);

  return (
    <div className="grid h-full min-h-[380px] grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
      <section className="min-h-0 rounded-lg border border-neutral-800 bg-neutral-900/60">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
          <div>
            <p className="text-xs text-neutral-500">Current path</p>
            <p className="truncate text-sm text-neutral-200">
              {currentPath || "/"}
            </p>
          </div>
          <button
            onClick={() => void refreshList(currentPath)}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-neutral-800 px-3 py-2">
          <button
            onClick={createFile}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            + File
          </button>
          <button
            onClick={createFolder}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            + Folder
          </button>
          {currentPath ? (
            <button
              onClick={() => void refreshList(parentPath(currentPath))}
              className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              Up
            </button>
          ) : null}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loadingList ? (
            <p className="px-2 py-4 text-sm text-neutral-500">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="px-2 py-4 text-sm text-neutral-500">No files</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.path}
                className="group mb-1 flex items-center gap-2 rounded px-2 py-1 hover:bg-neutral-800"
              >
                <button
                  onClick={() => {
                    if (entry.isDir) {
                      void refreshList(entry.path);
                    } else {
                      void openFile(entry.path, activePaneIdRef.current);
                    }
                  }}
                  className="min-w-0 flex-1 truncate text-left text-sm text-neutral-200"
                  title={entry.path}
                >
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${
                      entry.isDir ? "bg-amber-400" : "bg-sky-400"
                    }`}
                  />
                  {entry.name}
                  {entry.isSymlink ? " (symlink)" : ""}
                </button>
                <button
                  onClick={() => void renameEntry(entry)}
                  className="hidden rounded border border-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-700 group-hover:block"
                >
                  Rename
                </button>
                <button
                  onClick={() => void deleteEntry(entry)}
                  className="hidden rounded border border-neutral-700 px-1.5 py-0.5 text-[11px] text-red-300 hover:bg-neutral-700 group-hover:block"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="min-h-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 p-2">
        <FilePaneRenderer
          node={tree}
          activePaneId={activePaneId}
          docs={docsMap}
          busyPath={busyPath}
          onActivate={setActivePaneId}
          onSplit={splitActivePane}
          onClose={closeEditorPane}
          onSelectDoc={(paneId, filePath) =>
            setTree((prev) => updateLeafSession(prev, paneId, filePath))
          }
          onDocChange={(filePath, content) => {
            setDocs((prev) => ({
              ...prev,
              [filePath]: { ...prev[filePath], content },
            }));
          }}
          onSaveDoc={(filePath) => {
            void saveDoc(filePath);
          }}
          onRatioChange={updatePaneRatio}
        />
      </section>

      {error ? (
        <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300 xl:col-span-2">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function findFirstLeaf(
  node: PaneNode,
): { id: string; sessionId: string | null } | null {
  if (node.type === "leaf") return node;
  return findFirstLeaf(node.children[0]) ?? findFirstLeaf(node.children[1]);
}
