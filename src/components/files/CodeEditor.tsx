"use client";

import CodeMirror from "@uiw/react-codemirror";
import type { Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { useTheme } from "@/lib/hooks/useTheme";

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

const warmCodeEditorTheme: Extension = [
  EditorView.theme(
    {
      "&": {
        backgroundColor: "#f2ead7",
        color: "#2d281d",
      },
      ".cm-content": {
        caretColor: "#0f7d91",
        fontFamily:
          '"SF Mono", Menlo, Monaco, "Apple SD Gothic Neo", "Noto Sans Mono CJK KR", ui-monospace, monospace',
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "#0f7d91",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: "#d0bd8f",
        },
      ".cm-gutters": {
        backgroundColor: "#e5d8b9",
        color: "#8c7a55",
        borderRightColor: "#c8b68b",
      },
      ".cm-activeLine": {
        backgroundColor: "rgba(203, 183, 140, 0.28)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "#d9c9a7",
        color: "#2d281d",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        color: "#8c7a55",
      },
      ".cm-foldGutter .cm-gutterElement": {
        color: "#8c7a55",
      },
      ".cm-panels": {
        backgroundColor: "#e5d8b9",
        color: "#2d281d",
      },
      ".cm-tooltip": {
        backgroundColor: "#f4ecd8",
        color: "#2d281d",
        borderColor: "#c8b68b",
      },
      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "#d9c9a7",
        color: "#2d281d",
      },
    },
    { dark: false },
  ),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "#8a5a17" },
      { tag: [tags.name, tags.deleted, tags.character], color: "#2d281d" },
      { tag: [tags.propertyName, tags.attributeName], color: "#176f91" },
      {
        tag: [tags.function(tags.variableName), tags.labelName],
        color: "#0f7d91",
      },
      {
        tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
        color: "#87598c",
      },
      { tag: [tags.definition(tags.name), tags.separator], color: "#2d281d" },
      { tag: [tags.brace, tags.squareBracket, tags.paren], color: "#65583e" },
      { tag: [tags.annotation, tags.modifier], color: "#8a5a17" },
      { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#92712c" },
      {
        tag: [tags.string, tags.special(tags.string), tags.regexp],
        color: "#507536",
      },
      {
        tag: [tags.comment, tags.quote],
        color: "#8c7a55",
        fontStyle: "italic",
      },
      { tag: tags.invalid, color: "#9f3434" },
    ]),
  ),
];

export default function CodeEditor({
  value,
  onChange,
  languageId,
  readOnly = false,
  height = "100%",
}: CodeEditorProps) {
  const { theme } = useTheme();

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        height={height}
        theme={theme === "warm" ? warmCodeEditorTheme : oneDark}
        extensions={toExtensions(languageId)}
        className="h-full max-w-full"
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
