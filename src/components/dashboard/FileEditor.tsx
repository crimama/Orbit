"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeEditor, { languageFromPath } from "@/components/files/CodeEditor";
import type {
  ApiError,
  ApiResponse,
  ProjectFileReadResponse,
  ProjectFileWriteResponse,
} from "@/lib/types";

type EditorMode = "edit" | "preview" | "split";
type SaveStatus = "idle" | "saved" | "error" | "conflict";

interface FileEditorProps {
  projectId: string;
  filePath: string;
  initialContent: string;
  initialMtimeMs: number;
  onClose?: () => void;
}

export default function FileEditor({
  projectId,
  filePath,
  initialContent,
  initialMtimeMs,
  onClose,
}: FileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [savedMtimeMs, setSavedMtimeMs] = useState(initialMtimeMs);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const isMarkdown = /\.mdx?$/i.test(filePath);
  const [editorMode, setEditorMode] = useState<EditorMode>(
    isMarkdown ? "preview" : "edit",
  );
  const clearStatusTimerRef = useRef<number | null>(null);

  const dirty = content !== savedContent;

  const clearStatusTimer = useCallback(() => {
    if (clearStatusTimerRef.current === null) return;
    window.clearTimeout(clearStatusTimerRef.current);
    clearStatusTimerRef.current = null;
  }, []);

  const markSavedBriefly = useCallback(() => {
    clearStatusTimer();
    setSaveStatus("saved");
    clearStatusTimerRef.current = window.setTimeout(() => {
      setSaveStatus("idle");
      clearStatusTimerRef.current = null;
    }, 1800);
  }, [clearStatusTimer]);

  useEffect(() => {
    setContent(initialContent);
    setSavedContent(initialContent);
    setSavedMtimeMs(initialMtimeMs);
    setSaving(false);
    setSaveStatus("idle");
    setEditorMode(/\.mdx?$/i.test(filePath) ? "preview" : "edit");
    clearStatusTimer();
  }, [clearStatusTimer, initialContent, initialMtimeMs, projectId, filePath]);

  useEffect(() => {
    return () => clearStatusTimer();
  }, [clearStatusTimer]);

  const save = useCallback(
    async (contentToSave = content) => {
      setSaving(true);
      clearStatusTimer();
      setSaveStatus("idle");
      try {
        const query = new URLSearchParams({ path: filePath }).toString();
        const res = await fetch(
          `/api/projects/${projectId}/files/write?${query}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: contentToSave,
              expectedMtimeMs: savedMtimeMs,
            }),
          },
        );
        const json = (await res.json()) as
          | ApiResponse<ProjectFileWriteResponse>
          | ApiError;
        if (!res.ok || "error" in json) {
          setSaveStatus(res.status === 409 ? "conflict" : "error");
          return;
        }
        setSavedContent(contentToSave);
        setSavedMtimeMs(json.data.mtimeMs);
        markSavedBriefly();
      } catch {
        setSaveStatus("error");
      } finally {
        setSaving(false);
      }
    },
    [
      clearStatusTimer,
      content,
      filePath,
      markSavedBriefly,
      projectId,
      savedMtimeMs,
    ],
  );

  const reloadFromDisk = useCallback(async () => {
    setSaving(true);
    clearStatusTimer();
    try {
      const query = new URLSearchParams({ path: filePath }).toString();
      const res = await fetch(`/api/projects/${projectId}/files/read?${query}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as
        | ApiResponse<ProjectFileReadResponse>
        | ApiError;
      if (!res.ok || "error" in json || json.data.isBinary) {
        setSaveStatus("error");
        return;
      }

      const nextContent = json.data.content ?? "";
      setContent(nextContent);
      setSavedContent(nextContent);
      setSavedMtimeMs(json.data.mtimeMs);
      setSaveStatus("idle");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [clearStatusTimer, filePath, projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !saving) {
          void save();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dirty, saving, save]);

  useEffect(() => {
    if (!isMarkdown || !dirty || saving || saveStatus === "conflict") return;

    const contentToSave = content;
    const timerId = window.setTimeout(() => {
      void save(contentToSave);
    }, 900);

    return () => window.clearTimeout(timerId);
  }, [content, dirty, isMarkdown, save, saveStatus, saving]);

  useEffect(() => {
    if (
      !isMarkdown ||
      editorMode === "edit" ||
      dirty ||
      saving ||
      saveStatus === "conflict"
    ) {
      return;
    }

    let cancelled = false;
    const syncPreview = async () => {
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
        if (!res.ok || "error" in json || json.data.isBinary) {
          return;
        }
        if (cancelled) return;

        const nextContent = json.data.content ?? "";
        if (
          json.data.mtimeMs === savedMtimeMs &&
          nextContent === savedContent
        ) {
          return;
        }

        setContent(nextContent);
        setSavedContent(nextContent);
        setSavedMtimeMs(json.data.mtimeMs);
        setSaveStatus("idle");
      } catch {
        // Best-effort sync for preview only.
      }
    };

    void syncPreview();
    const intervalId = window.setInterval(() => {
      void syncPreview();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    dirty,
    editorMode,
    filePath,
    isMarkdown,
    projectId,
    savedContent,
    savedMtimeMs,
    saveStatus,
    saving,
  ]);

  const preview = (
    <div
      className="h-full overflow-y-auto px-6 py-4 prose prose-invert prose-sm max-w-none
        prose-headings:text-neutral-100 prose-headings:font-semibold
        prose-h1:text-lg prose-h1:border-b prose-h1:border-neutral-800 prose-h1:pb-2
        prose-h2:text-base prose-h3:text-sm
        prose-p:text-neutral-300 prose-p:leading-relaxed
        prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-neutral-200
        prose-code:text-amber-300 prose-code:bg-neutral-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-800 prose-pre:rounded-lg
        prose-li:text-neutral-300
        prose-table:text-xs
        prose-th:text-neutral-400 prose-th:border-neutral-700
        prose-td:border-neutral-800
        prose-hr:border-neutral-800
        prose-blockquote:border-neutral-700 prose-blockquote:text-neutral-400"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-neutral-950">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-300">
          {filePath}
          {dirty && (
            <span className="ml-1.5 text-amber-400" title="Unsaved changes">
              *
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
          title="Save (Ctrl+S)"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saving && <span className="text-xs text-neutral-500">Saving</span>}
        {saveStatus === "saved" && (
          <span className="text-xs text-emerald-400">Saved</span>
        )}
        {isMarkdown && dirty && !saving && saveStatus === "idle" && (
          <span className="text-xs text-amber-400">Autosave pending</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-400">Error</span>
        )}
        {saveStatus === "conflict" && (
          <>
            <span className="text-xs text-red-400">Conflict</span>
            <button
              type="button"
              onClick={() => void reloadFromDisk()}
              className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              title="Reload latest file content from disk"
            >
              Reload
            </button>
          </>
        )}
        {isMarkdown && (
          <div className="flex shrink-0 overflow-hidden rounded border border-neutral-800">
            {(["edit", "split", "preview"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEditorMode(mode)}
                className={`px-2 py-0.5 text-xs font-medium capitalize transition ${
                  editorMode === mode
                    ? "bg-neutral-700 text-neutral-100"
                    : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
          >
            Close
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {isMarkdown && editorMode === "preview" ? (
          preview
        ) : isMarkdown && editorMode === "split" ? (
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-2">
            <div className="min-h-0 overflow-hidden border-b border-neutral-800 md:border-b-0 md:border-r">
              <CodeEditor
                value={content}
                onChange={setContent}
                languageId={languageFromPath(filePath)}
              />
            </div>
            <div className="min-h-0 overflow-hidden">{preview}</div>
          </div>
        ) : (
          <CodeEditor
            value={content}
            onChange={setContent}
            languageId={languageFromPath(filePath)}
          />
        )}
      </div>
    </div>
  );
}
