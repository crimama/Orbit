"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex h-full flex-col bg-neutral-950">
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
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-300 outline-none"
      />
    </div>
  );
}
