"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MultiTerminal from "./MultiTerminal";
import SessionMetricsPanel from "./SessionMetricsPanel";
import SessionNextSteps from "./SessionNextSteps";
import AgentRunLedgerPanel from "./AgentRunLedgerPanel";
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
    <div className="flex h-[100dvh] flex-col bg-orbit-bg-primary text-orbit-text-primary">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-orbit-border-subtle bg-orbit-surface-card/95 px-3 py-2.5 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-full border border-orbit-border-default bg-orbit-bg-tertiary px-3 py-1 text-sm text-orbit-text-primary hover:bg-neutral-800"
          >
            &larr; Back
          </button>
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="w-full max-w-sm rounded-full border border-orbit-border-default bg-orbit-bg-secondary px-3 py-1 text-sm text-orbit-text-primary"
                  placeholder="Session title"
                />
                <button
                  type="button"
                  onClick={() => void saveTitle()}
                  disabled={savingTitle}
                  className="rounded-full bg-orbit-accent-primary px-2.5 py-1 text-xs font-medium text-black hover:bg-orbit-accent-hover"
                >
                  {savingTitle ? "Saving" : "Save"}
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-base font-medium text-orbit-text-primary">
                  {headerTitle}
                </span>
                <span className="rounded-full bg-orbit-bg-tertiary px-2 py-0.5 font-mono text-xs text-orbit-text-secondary">
                  {sessionId.slice(0, 8)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="hidden rounded-full border border-orbit-border-default bg-orbit-bg-secondary p-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setViewMode("chat")}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                viewMode === "chat"
                  ? "bg-orbit-bg-tertiary text-orbit-text-primary"
                  : "text-orbit-text-secondary hover:text-orbit-text-primary"
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setViewMode("terminal")}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                viewMode === "terminal"
                  ? "bg-orbit-bg-tertiary text-orbit-text-primary"
                  : "text-orbit-text-secondary hover:text-orbit-text-primary"
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
              className="min-w-0 flex-1 rounded-full border border-orbit-border-default bg-orbit-bg-secondary px-3 py-1.5 text-sm text-orbit-text-primary shadow-sm focus:border-border-focus focus:outline-none sm:max-w-56 sm:flex-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id.slice(0, 8)} · {s.status}
                </option>
              ))}
            </select>
          )}
          <span className="hidden rounded-full border border-emerald-800 bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-400 sm:inline">
            Live
          </span>
          <span className="hidden rounded-full border border-sky-800 bg-sky-900/30 px-2.5 py-0.5 text-xs font-medium text-sky-400 sm:inline">
            {viewMode === "chat" ? "Chatbot" : "Terminal"}
          </span>
          <button
            type="button"
            onClick={() => setEditingTitle((prev) => !prev)}
            className="rounded-full border border-orbit-border-default bg-orbit-bg-secondary px-2.5 py-1 text-xs text-orbit-text-secondary hover:text-orbit-text-primary"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(sessionId);
            }}
            className="rounded-full border border-orbit-border-default bg-orbit-bg-secondary px-2.5 py-1 text-xs text-orbit-text-secondary hover:text-orbit-text-primary"
          >
            Copy ID
          </button>
          <button
            type="button"
            onClick={() => void terminateCurrentSession()}
            className="rounded-full border border-red-800 bg-red-900/20 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-900/30"
          >
            End Session
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2 sm:p-4">
        <div className="mx-auto flex h-full w-full max-w-[1040px] flex-col overflow-hidden rounded-3xl border border-orbit-border-subtle bg-orbit-surface-card shadow-[0_24px_60px_-34px_rgba(0,0,0,0.6)]">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-orbit-border-subtle bg-orbit-bg-secondary/90 px-3 py-2 text-sm backdrop-blur">
            <span className="rounded-full border border-orbit-border-default bg-orbit-bg-tertiary px-2 py-0.5 text-orbit-text-secondary">
              Session
            </span>
            <span className="text-orbit-text-muted">Timeline Workspace</span>
          </div>
          <SessionNextSteps sessionId={sessionId} />
          <AgentRunLedgerPanel sessionId={sessionId} />
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
