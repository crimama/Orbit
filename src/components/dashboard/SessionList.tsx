"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SessionInfo, SessionContext } from "@/lib/types";

interface SessionListProps {
  sessions: SessionInfo[];
  sessionContexts?: Map<string, SessionContext>;
  onTerminate: (id: string) => void;
  onTerminateAndRestart?: (id: string, options: { dangerouslySkipPermissions: boolean }) => void;
  onResume: (sessionRef: string, agentType?: string, projectId?: string) => void;
  onRename?: (id: string, newName: string) => void;
  onOpenSession?: (sessionId: string) => void;
  yoloMode?: boolean;
}

export default function SessionList({
  sessions,
  onTerminate,
  onTerminateAndRestart,
  sessionContexts,
  onResume,
  onRename,
  onOpenSession,
  yoloMode = false,
}: SessionListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  function startEditing(s: SessionInfo) {
    setEditingId(s.id);
    setEditValue(s.name ?? "");
  }

  function commitEdit() {
    if (!editingId || !onRename) return;
    const trimmed = editValue.trim();
    const current = sessions.find((s) => s.id === editingId);
    // Allow empty to clear name
    if (trimmed !== (current?.name ?? "")) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  if (sessions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-neutral-500">
        No sessions. Create one to start a terminal.
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-1">
      {sessions.map((s) => {
        const displayName = s.name || `${s.agentType} ${s.id.slice(0, 6)}`;
        const isYoloSession = yoloMode && s.status === "active";
        const statusDot = isYoloSession
          ? "bg-red-400"
          : s.status === "active"
            ? "bg-green-400"
            : s.status === "paused"
              ? "bg-yellow-400"
              : "bg-neutral-600";

        return (
          <div
            key={s.id}
            draggable={s.status === "active"}
            onDragStart={(e) => {
              if (s.status !== "active") return;
              e.dataTransfer.setData("application/x-orbit-session-id", s.id);
              e.dataTransfer.setData("text/plain", `session:${s.id}`);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="session-item group flex items-center gap-2 rounded-lg px-2 py-1.5 text-neutral-300 transition-colors hover:bg-neutral-800/60"
            style={{ borderLeft: `3px solid ${s.projectColor}` } as React.CSSProperties}
          >
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => {
                if (onOpenSession) {
                  onOpenSession(s.id);
                } else {
                  router.push(`/sessions/${s.id}`);
                }
              }}
            >
              {editingId === s.id ? (
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
                  placeholder={s.id.slice(0, 8)}
                  className="w-full rounded border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 font-mono text-xs text-neutral-100 outline-none focus:border-border-focus"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
                  <span
                    className="truncate text-xs text-neutral-200"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEditing(s);
                    }}
                    title={`${displayName} · ${s.agentType} · ${s.id.slice(0, 8)}`}
                  >
                    {displayName}
                  </span>
                  {isYoloSession && (
                    <span className="shrink-0 text-[9px] font-bold text-red-400">YOLO</span>
                  )}
                  {sessionContexts?.get(s.id)?.gitBranch && (
                    <span className="shrink-0 truncate text-[10px] text-cyan-400/60">
                      {sessionContexts.get(s.id)!.gitBranch}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
                    {new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
            <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
              {s.status === "active" && (
                <>
                  <button
                    onClick={() => onTerminate(s.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-neutral-700 hover:text-red-400"
                  >
                    Kill
                  </button>
                  {onTerminateAndRestart && s.agentType === "claude-code" && (
                    <button
                      onClick={() => onTerminateAndRestart(s.id, { dangerouslySkipPermissions: true })}
                      className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-neutral-700 hover:text-amber-400"
                      title="Kill and restart with --dangerously-skip-permissions"
                    >
                      YOLO
                    </button>
                  )}
                </>
              )}
              {s.status !== "active" && (
                <button
                  onClick={() => {
                    // Orbit-managed sessions: reopen directly by ID
                    // ensureSessionRunning will re-activate + create PTY
                    if (s.source !== "claude-history" && onOpenSession) {
                      onOpenSession(s.id);
                    } else {
                      // Claude history sessions: create new session with --resume
                      onResume(s.sessionRef, s.agentType, s.projectId);
                    }
                  }}
                  className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
                >
                  Resume
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
