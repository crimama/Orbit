"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeEditor, { languageFromPath } from "@/components/files/CodeEditor";

interface FileEditorProps {
  projectId: string;
  filePath: string;
  initialContent: string;
  onClose?: () => void;
}

export default function FileEditor({
  projectId,
  filePath,
  initialContent,
  onClose,
}: FileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const isMarkdown = /\.mdx?$/i.test(filePath);
  const [showPreview, setShowPreview] = useState(isMarkdown);

  const dirty = content !== savedContent;

  // Reset when a different file is loaded
  useEffect(() => {
    setContent(initialContent);
    setSavedContent(initialContent);
    setSaveStatus("idle");
  }, [initialContent, projectId, filePath]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const query = new URLSearchParams({ path: filePath }).toString();
      const res = await fetch(`/api/projects/${projectId}/files/write?${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      setSavedContent(content);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [projectId, filePath, content]);

  // Ctrl+S / Cmd+S
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
        {saveStatus === "saved" && (
          <span className="text-xs text-emerald-400">Saved</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-400">Error</span>
        )}
        {isMarkdown && (
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium transition ${
              showPreview
                ? "bg-neutral-700 text-neutral-100"
                : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
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
        {showPreview && isMarkdown ? (
          <div className="h-full overflow-y-auto px-6 py-4 prose prose-invert prose-sm max-w-none
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
            prose-blockquote:border-neutral-700 prose-blockquote:text-neutral-400
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <CodeEditor
            value={content}
            onChange={setContent}
            languageId={languageFromPath(filePath)}
            readOnly={saving}
          />
        )}
      </div>
    </div>
  );
}
