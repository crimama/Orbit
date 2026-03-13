"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SessionInfo } from "@/lib/types";

interface SessionListProps {
  sessions: SessionInfo[];
  onTerminate: (id: string) => void;
  onResume: (sessionRef: string, agentType?: string) => void;
  onRename?: (id: string, newName: string) => void;
  onOpenSession?: (sessionId: string) => void;
  yoloMode?: boolean;
}

export default function SessionList({
  sessions,
  onTerminate,
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
    <div className="space-y-2 p-2">
      {sessions.map((s) => {
        const displayName = s.name || s.id.slice(0, 8);
        const isYoloSession = yoloMode && s.status === "active";
        const statusBadgeClass = isYoloSession
          ? "border border-red-500/40 bg-red-500/15 text-red-300"
          : s.status === "active"
            ? "border border-green-500/30 bg-green-500/10 text-green-300"
            : s.status === "paused"
              ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
              : "border border-neutral-700 bg-neutral-900 text-neutral-500";

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
            className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 text-neutral-300 transition-colors"
            style={{ borderLeft: `4px solid ${s.projectColor}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${s.projectColor}12`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "";
            }}
          >
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {isYoloSession ? (
                <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                  YOLO
                </span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass}`}
              >
                {s.status}
              </span>
            </div>
            <div
              className="min-w-0 flex-1 cursor-pointer pr-24"
              onClick={() => {
                if (onOpenSession) {
                  onOpenSession(s.id);
                } else {
                  router.push(`/sessions/${s.id}`);
                }
              }}
            >
              <div className="flex items-start gap-2">
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
                    className="w-40 rounded border border-neutral-600 bg-neutral-900 px-1.5 py-0.5 font-mono text-xs text-neutral-100 outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="min-w-0">
                    <div
                      className="truncate font-mono text-xs text-neutral-200"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditing(s);
                      }}
                      title={
                        s.name
                          ? `${s.name} (${s.id.slice(0, 8)})`
                          : s.id.slice(0, 8)
                      }
                    >
                      {displayName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {s.id.slice(0, 8)}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.projectColor }}
                  aria-hidden
                />
                <span
                  className="max-w-[180px] truncate text-neutral-400"
                  title={s.projectName}
                >
                  {s.projectName}
                </span>
                <span>&middot;</span>
                <span>{s.agentType}</span>
                <span>&middot;</span>
                <span>{new Date(s.updatedAt).toLocaleTimeString()}</span>
                {s.source === "claude-history" && (
                  <span className="ml-2 text-neutral-600">history</span>
                )}
              </div>
              {s.lastContext && (
                <div className="mt-3 line-clamp-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 font-mono text-xs leading-5 text-neutral-400">
                  {s.lastContext}
                </div>
              )}
            </div>
            <div className="ml-3 flex items-center gap-1 self-end sm:self-center">
              {/* Rename button */}
              {onRename && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(s);
                  }}
                  className="rounded p-1 text-neutral-600 hover:bg-neutral-700 hover:text-neutral-300 sm:hidden sm:group-hover:block"
                  title="Rename"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                    />
                  </svg>
                </button>
              )}
              {s.status === "active" && (
                <button
                  onClick={() => onTerminate(s.id)}
                  className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-700 hover:text-red-400 sm:hidden sm:group-hover:block"
                >
                  Kill
                </button>
              )}
              {s.status !== "active" && (
                <button
                  onClick={() => onResume(s.sessionRef, s.agentType)}
                  className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200 sm:hidden sm:group-hover:block"
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
