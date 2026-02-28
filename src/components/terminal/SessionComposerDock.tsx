"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePendingApprovals } from "@/lib/hooks/usePendingApprovals";

type DockMode = "prompt" | "question" | "approval" | "todo";

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface SessionComposerDockProps {
  sessionId: string;
  onFocusChange?: (focused: boolean) => void;
  focusSignal?: number;
}

export default function SessionComposerDock({
  sessionId,
  onFocusChange,
  focusSignal,
}: SessionComposerDockProps) {
  const [mode, setMode] = useState<DockMode>("prompt");
  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todoInput, setTodoInput] = useState("");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const { pendingApprovals, approve, deny } = usePendingApprovals();

  const sessionApprovals = useMemo(
    () => pendingApprovals.filter((item) => item.sessionId === sessionId),
    [pendingApprovals, sessionId],
  );

  const activeApproval =
    sessionApprovals.length > 0 ? sessionApprovals[0] : null;

  useEffect(() => {
    if (activeApproval) {
      setMode("approval");
    }
  }, [activeApproval]);

  useEffect(() => {
    if (focusSignal === undefined) return;
    const target = document.querySelector<HTMLTextAreaElement>(
      `[data-composer-input="${sessionId}"]`,
    );
    target?.focus();
  }, [focusSignal, sessionId]);

  async function submitPrompt(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: prompt, appendNewline: true }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to send command");
      }
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send command");
    } finally {
      setSending(false);
    }
  }

  function submitQuestion(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setPrompt((prev) => {
      const prefix = prev.trim() ? `${prev}\n` : "";
      return `${prefix}# Question: ${question.trim()}`;
    });
    setQuestion("");
    setMode("prompt");
  }

  function addTodo(e: FormEvent) {
    e.preventDefault();
    if (!todoInput.trim()) return;
    setTodos((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        text: todoInput.trim(),
        done: false,
      },
    ]);
    setTodoInput("");
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-300 bg-slate-100/90 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(["prompt", "question", "approval", "todo"] as DockMode[]).map(
          (item) => {
            const active = mode === item;
            const label =
              item === "approval"
                ? `approval (${sessionApprovals.length})`
                : item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            );
          },
        )}
      </div>

      {mode === "prompt" && (
        <form onSubmit={submitPrompt} className="space-y-2">
          <textarea
            data-composer-input={sessionId}
            value={prompt}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Type command or prompt for this session..."
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !prompt.trim()}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      )}

      {mode === "question" && (
        <form onSubmit={submitQuestion} className="space-y-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Capture a question to include in prompt"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!question.trim()}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Add to prompt
            </button>
          </div>
        </form>
      )}

      {mode === "approval" && (
        <div className="space-y-2">
          {!activeApproval ? (
            <p className="text-xs text-slate-600">
              No pending approvals for this session.
            </p>
          ) : (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="font-mono text-xs text-amber-900">
                {activeApproval.command}
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                Rule: {activeApproval.matchedRule.description}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => deny(activeApproval.id)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => approve(activeApproval.id)}
                  className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white"
                >
                  Approve
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "todo" && (
        <div className="space-y-2">
          <form onSubmit={addTodo} className="flex gap-2">
            <input
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              placeholder="Add session todo"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
            >
              Add
            </button>
          </form>
          <div className="max-h-28 space-y-1 overflow-auto">
            {todos.length === 0 && (
              <p className="text-xs text-slate-600">No todos yet.</p>
            )}
            {todos.map((todo) => (
              <label
                key={todo.id}
                className="flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span
                  className={todo.done ? "text-slate-400 line-through" : ""}
                >
                  {todo.text}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
