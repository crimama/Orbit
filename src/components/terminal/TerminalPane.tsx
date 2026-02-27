"use client";

import TerminalView from "./TerminalView";
import type { OrbitSocket } from "@/lib/socketClient";
import type { SessionInfo } from "@/lib/types";

interface TerminalPaneProps {
  paneId: string;
  sessionId: string | null;
  socket: OrbitSocket | undefined;
  connected: boolean;
  isActive: boolean;
  exited: boolean;
  sessions: SessionInfo[];
  onActivate: () => void;
  onSplit: (direction: "horizontal" | "vertical") => void;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onExit: () => void;
  canClose: boolean;
}

export default function TerminalPane({
  paneId,
  sessionId,
  socket,
  connected,
  isActive,
  exited,
  sessions,
  onActivate,
  onSplit,
  onClose,
  onSelectSession,
  onExit,
  canClose,
}: TerminalPaneProps) {
  const currentSession = sessionId
    ? sessions.find((s) => s.id === sessionId)
    : null;
  const projectColor = currentSession?.projectColor;
  const formatSessionLabel = (session: SessionInfo) => {
    const sessionName = session.name ?? `${session.agentType} (${session.id.slice(0, 8)})`;
    return `${session.projectName} / ${sessionName} · ${session.status}`;
  };

  return (
    <div
      className={`flex h-full w-full flex-col ${
        isActive ? "ring-1 ring-inset" : ""
      }`}
      style={isActive && projectColor ? { boxShadow: `inset 0 0 0 1px ${projectColor}50` } : undefined}
      onClick={onActivate}
    >
      {/* Mini header */}
      <div
        className="flex min-w-0 flex-shrink-0 items-center gap-1 border-b bg-slate-900/60 px-2 py-1"
        style={{ borderBottomColor: projectColor ?? "#334155" }}
      >
        <span className="hidden rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-100 sm:inline">
          Assistant
        </span>
        {/* Project color + status indicator */}
        {sessionId ? (
          <span
            className="mr-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: exited ? "#ef4444" : (projectColor ?? "#22c55e") }}
            title={exited ? "Exited" : (currentSession?.projectName ?? "Active")}
          />
        ) : (
          <span className="mr-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-neutral-600" title="No session" />
        )}

        <select
          value={sessionId ?? ""}
          onChange={(e) => {
            if (e.target.value) onSelectSession(e.target.value);
          }}
          className="min-w-0 flex-1 truncate rounded border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-sm text-slate-100 outline-none focus:border-sky-500 sm:max-w-72 sm:flex-none"
        >
          <option value="">Select session...</option>
          {sessions
            .filter((s) => s.status === "active")
            .map((s) => (
              <option key={s.id} value={s.id}>
                {formatSessionLabel(s)}
              </option>
            ))}
        </select>

        {sessionId && (
          <span className={`ml-1 hidden text-xs sm:inline ${exited ? "text-red-300" : "text-green-300"}`}>
            {exited ? "Exited" : "Active"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onSplit("horizontal"); }}
            title="Split Horizontal"
            className="rounded px-1.5 py-0.5 text-sm text-slate-300 hover:bg-slate-700/70 hover:text-white"
          >
            ⎸
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSplit("vertical"); }}
            title="Split Vertical"
            className="rounded px-1.5 py-0.5 text-sm text-slate-300 hover:bg-slate-700/70 hover:text-white"
          >
            ⎯
          </button>
          {canClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              title="Close Pane"
              className="rounded px-1.5 py-0.5 text-sm text-neutral-300 hover:bg-red-900/50 hover:text-red-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Terminal or placeholder */}
      <div className="flex-1 overflow-hidden">
        {sessionId && socket ? (
          <TerminalView
            key={`${paneId}-${sessionId}`}
            sessionId={sessionId}
            socket={socket}
            connected={connected}
            onExit={onExit}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-950/60">
            <p className="text-base text-slate-300">Select a session</p>
          </div>
        )}
      </div>
    </div>
  );
}
