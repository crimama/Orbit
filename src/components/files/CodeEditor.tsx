"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";

type LanguageId =
  | "plain"
  | "javascript"
  | "json"
  | "markdown"
  | "python"
  | "css"
  | "html";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  languageId: LanguageId;
  readOnly?: boolean;
  height?: string;
}

function toExtensions(languageId: LanguageId) {
  if (languageId === "javascript")
    return [javascript({ jsx: true, typescript: true })];
  if (languageId === "json") return [json()];
  if (languageId === "markdown") return [markdown()];
  if (languageId === "python") return [python()];
  if (languageId === "css") return [css()];
  if (languageId === "html") return [html()];
  return [];
}

export default function CodeEditor({
  value,
  onChange,
  languageId,
  readOnly = false,
  height = "100%",
}: CodeEditorProps) {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        height={height}
        theme="dark"
        extensions={toExtensions(languageId)}
        className="h-full"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          autocompletion: true,
        }}
      />
    </div>
  );
}

export function languageFromPath(filePath: string): LanguageId {
  const normalized = filePath.trim().toLowerCase();
  if (
    normalized.endsWith(".ts") ||
    normalized.endsWith(".tsx") ||
    normalized.endsWith(".js") ||
    normalized.endsWith(".jsx")
  )
    return "javascript";
  if (normalized.endsWith(".json")) return "json";
  if (normalized.endsWith(".md")) return "markdown";
  if (normalized.endsWith(".py")) return "python";
  if (normalized.endsWith(".css")) return "css";
  if (normalized.endsWith(".html")) return "html";
  return "plain";
}
