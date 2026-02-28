"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SessionInfo } from "@/lib/types";

interface SessionListProps {
  sessions: SessionInfo[];
  onTerminate: (id: string) => void;
  onResume: (sessionRef: string) => void;
  onRename?: (id: string, newName: string) => void;
  onOpenSession?: (sessionId: string) => void;
}

const statusColors: Record<string, string> = {
  active: "text-green-400",
  paused: "text-yellow-400",
  terminated: "text-neutral-600",
};

export default function SessionList({
  sessions,
  onTerminate,
  onResume,
  onRename,
  onOpenSession,
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
    <div className="space-y-1 p-2">
      {sessions.map((s) => {
        const displayName = s.name || s.id.slice(0, 8);

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
            className="group flex items-center justify-between overflow-hidden rounded-lg py-2 pl-4 pr-3 text-neutral-300 transition-colors"
            style={{ borderLeft: `3px solid ${s.projectColor}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${s.projectColor}10`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "";
            }}
          >
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => {
                if (s.status === "active") {
                  if (onOpenSession) {
                    onOpenSession(s.id);
                  } else {
                    router.push(`/sessions/${s.id}`);
                  }
                }
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${statusColors[s.status] ?? "text-neutral-500"}`}
                >
                  {s.status}
                </span>
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
                  <span
                    className="font-mono text-xs text-neutral-400"
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
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-500">
                {s.agentType} &middot;{" "}
                {new Date(s.updatedAt).toLocaleTimeString()}
                {s.source === "claude-history" && (
                  <span className="ml-2 text-neutral-600">history</span>
                )}
              </div>
              {s.lastContext && (
                <div className="truncate text-xs text-neutral-600">
                  {s.lastContext}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Rename button */}
              {onRename && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(s);
                  }}
                  className="hidden rounded p-1 text-neutral-600 hover:bg-neutral-700 hover:text-neutral-300 group-hover:block"
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
                  className="hidden rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-700 hover:text-red-400 group-hover:block"
                >
                  Kill
                </button>
              )}
              {s.source === "claude-history" && (
                <button
                  onClick={() => onResume(s.sessionRef)}
                  className="hidden rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200 group-hover:block"
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
