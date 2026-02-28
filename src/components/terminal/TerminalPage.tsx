"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MultiTerminal from "./MultiTerminal";
import SessionMetricsPanel from "./SessionMetricsPanel";
import SessionNextSteps from "./SessionNextSteps";
import SessionChatbotView from "./SessionChatbotView";
import type { SessionInfo, ApiResponse } from "@/lib/types";

interface TerminalPageProps {
  sessionId: string;
  initialWorkspaceId?: string | null;
  projectName?: string;
}

export default function TerminalPage({
  sessionId,
  initialWorkspaceId,
  projectName,
}: TerminalPageProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [jumpTarget, setJumpTarget] = useState(sessionId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [viewMode, setViewMode] = useState<"chat" | "terminal">("chat");

  const currentSession = useMemo(
    () => sessions.find((item) => item.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  const headerTitle =
    currentSession?.name?.trim() ||
    `${projectName ? `${projectName} / ` : ""}${sessionId.slice(0, 8)}`;

  useEffect(() => {
    setJumpTarget(sessionId);
  }, [sessionId]);

  useEffect(() => {
    setTitleDraft(currentSession?.name ?? "");
  }, [currentSession?.name, sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions");
        const json = (await res.json()) as ApiResponse<SessionInfo[]>;
        if (!cancelled && "data" in json) {
          setSessions((prev) => {
            const next = json.data;
            if (
              prev.length === next.length &&
              prev.every(
                (p, i) => p.id === next[i].id && p.status === next[i].status,
              )
            ) {
              return prev;
            }
            return next;
          });
        }
      } catch {
        // Ignore fetch errors on jump list.
      }
    }

    void fetchSessions();
    const timer = setInterval(fetchSessions, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function saveTitle() {
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: titleDraft }),
      });
      if (!res.ok) throw new Error("Failed to update session title");
      setEditingTitle(false);
      const json = (await res.json()) as ApiResponse<SessionInfo>;
      if ("data" in json) {
        setSessions((prev) => {
          const exists = prev.some((item) => item.id === sessionId);
          if (!exists) return prev;
          return prev.map((item) => (item.id === sessionId ? json.data : item));
        });
      }
    } finally {
      setSavingTitle(false);
    }
  }

  async function terminateCurrentSession() {
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-slate-300/90 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
          >
            &larr; Back
          </button>
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="w-full max-w-sm rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800"
                  placeholder="Session title"
                />
                <button
                  type="button"
                  onClick={() => void saveTitle()}
                  disabled={savingTitle}
                  className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                >
                  {savingTitle ? "Saving" : "Save"}
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-base font-medium text-slate-900">
                  {headerTitle}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                  {sessionId.slice(0, 8)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="hidden rounded-full border border-slate-300 bg-white p-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setViewMode("chat")}
              className={`rounded-full px-2.5 py-1 text-xs ${
                viewMode === "chat"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700"
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setViewMode("terminal")}
              className={`rounded-full px-2.5 py-1 text-xs ${
                viewMode === "terminal"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700"
              }`}
            >
              Terminal
            </button>
          </div>

          {sessions.length > 1 && (
            <select
              value={jumpTarget}
              onChange={(e) => {
                const next = e.target.value;
                setJumpTarget(next);
                if (next && next !== sessionId) {
                  router.push(`/sessions/${next}`);
                }
              }}
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-sky-300 focus:outline-none sm:max-w-56 sm:flex-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id.slice(0, 8)} · {s.status}
                </option>
              ))}
            </select>
          )}
          <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 sm:inline">
            Live
          </span>
          <span className="hidden rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 sm:inline">
            {viewMode === "chat" ? "Chatbot" : "Terminal"}
          </span>
          <button
            type="button"
            onClick={() => setEditingTitle((prev) => !prev)}
            className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(sessionId);
            }}
            className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
          >
            Copy ID
          </button>
          <button
            type="button"
            onClick={() => void terminateCurrentSession()}
            className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
          >
            End Session
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2 sm:p-4">
        <div className="mx-auto flex h-full w-full max-w-[1040px] flex-col overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)]">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-slate-100/90 px-3 py-2 text-sm backdrop-blur">
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
              Session
            </span>
            <span className="text-slate-600">Timeline Workspace</span>
          </div>
          <SessionNextSteps sessionId={sessionId} />
          <SessionMetricsPanel sessionId={sessionId} />
          <div className="min-h-0 flex-1">
            {viewMode === "chat" ? (
              <SessionChatbotView sessionId={sessionId} />
            ) : (
              <MultiTerminal
                initialSessionId={sessionId}
                initialWorkspaceId={initialWorkspaceId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
