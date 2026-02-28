"use client";

import { useState, type DragEvent } from "react";
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
  onDropSession?: (
    sessionId: string,
    position: "top" | "bottom" | "left" | "right" | "center",
  ) => void;
  onSwapPane?: (sourcePaneId: string) => void;
  onMovePane?: (
    sourcePaneId: string,
    position: "top" | "bottom" | "left" | "right",
  ) => void;
  onExit: () => void;
  canClose: boolean;
  onKillSession?: () => Promise<void> | void;
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
  onDropSession,
  onSwapPane,
  onMovePane,
  onExit,
  canClose,
  onKillSession,
}: TerminalPaneProps) {
  const currentSession = sessionId
    ? sessions.find((s) => s.id === sessionId)
    : null;
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [dropRegion, setDropRegion] = useState<
    "top" | "bottom" | "left" | "right" | "center" | null
  >(null);
  const projectColor = currentSession?.projectColor;
  const formatSessionLabel = (session: SessionInfo) => {
    const sessionName =
      session.name ?? `${session.agentType} (${session.id.slice(0, 8)})`;
    return `${session.projectName} / ${sessionName} · ${session.status}`;
  };

  const readDraggedSessionId = (e: DragEvent<HTMLDivElement>) => {
    const custom = e.dataTransfer.getData("application/x-orbit-session-id");
    if (custom) return custom;
    const plain = e.dataTransfer.getData("text/plain");
    if (plain.startsWith("session:")) {
      return plain.slice("session:".length);
    }
    return "";
  };

  const readDraggedPaneId = (e: DragEvent<HTMLDivElement>) => {
    const custom = e.dataTransfer.getData("application/x-orbit-pane-id");
    if (custom) return custom;
    const plain = e.dataTransfer.getData("text/plain");
    if (plain.startsWith("pane:")) {
      return plain.slice("pane:".length);
    }
    return "";
  };

  const getDropRegion = (
    e: DragEvent<HTMLDivElement>,
  ): "top" | "bottom" | "left" | "right" | "center" => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width || 1;
    const height = rect.height || 1;
    const nx = x / width;
    const ny = y / height;
    const edge = 0.28;

    if (ny <= edge) return "top";
    if (ny >= 1 - edge) return "bottom";
    if (nx <= edge) return "left";
    if (nx >= 1 - edge) return "right";
    return "center";
  };

  const hasDraggedSession = (e: DragEvent<HTMLDivElement>) => {
    const types = Array.from(e.dataTransfer.types);
    return (
      types.includes("application/x-orbit-session-id") ||
      e.dataTransfer.getData("text/plain").startsWith("session:")
    );
  };

  const hasDraggedPane = (e: DragEvent<HTMLDivElement>) => {
    const types = Array.from(e.dataTransfer.types);
    return (
      types.includes("application/x-orbit-pane-id") ||
      e.dataTransfer.getData("text/plain").startsWith("pane:")
    );
  };

  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-2xl border border-slate-300 bg-white ${
        isActive || isDropTarget ? "ring-1 ring-inset" : ""
      }`}
      style={
        isDropTarget
          ? { boxShadow: "inset 0 0 0 2px #38bdf8" }
          : isActive && projectColor
            ? { boxShadow: `inset 0 0 0 1px ${projectColor}50` }
            : undefined
      }
      onClick={onActivate}
      onDragOver={(e) => {
        if (!hasDraggedSession(e) && !hasDraggedPane(e)) return;
        e.preventDefault();
        setDropRegion(getDropRegion(e));
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(e) => {
        if (!hasDraggedSession(e) && !hasDraggedPane(e)) return;
        e.preventDefault();
        setIsDropTarget(true);
        setDropRegion(getDropRegion(e));
      }}
      onDragLeave={() => {
        setIsDropTarget(false);
        setDropRegion(null);
      }}
      onDrop={(e) => {
        const draggedSessionId = readDraggedSessionId(e);
        const draggedPaneId = readDraggedPaneId(e);
        const region = getDropRegion(e);
        setIsDropTarget(false);
        setDropRegion(null);
        if (!draggedSessionId && !draggedPaneId) return;
        e.preventDefault();
        if (draggedSessionId) {
          if (onDropSession) {
            onDropSession(draggedSessionId, region);
          } else {
            onSelectSession(draggedSessionId);
          }
          return;
        }
        if (draggedPaneId && draggedPaneId !== paneId) {
          if (region === "center") {
            onSwapPane?.(draggedPaneId);
            return;
          }
          onMovePane?.(draggedPaneId, region);
        }
      }}
    >
      {isDropTarget && dropRegion && (
        <div
          className={`pointer-events-none absolute z-10 rounded-xl bg-sky-400/25 transition-all ${
            dropRegion === "center"
              ? "inset-2"
              : dropRegion === "top"
                ? "left-2 right-2 top-2 h-[28%]"
                : dropRegion === "bottom"
                  ? "bottom-2 left-2 right-2 h-[28%]"
                  : dropRegion === "left"
                    ? "bottom-2 left-2 top-2 w-[28%]"
                    : "bottom-2 right-2 top-2 w-[28%]"
          }`}
        />
      )}
      {/* Mini header */}
      <div
        draggable
        onDragStart={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button,select,input")) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData("application/x-orbit-pane-id", paneId);
          e.dataTransfer.setData("text/plain", `pane:${paneId}`);
          e.dataTransfer.effectAllowed = "move";
        }}
        className="flex min-w-0 flex-shrink-0 items-center gap-1.5 border-b bg-slate-100/90 px-2.5 py-1.5"
        style={{ borderBottomColor: projectColor ?? "#cbd5e1" }}
      >
        <span className="hidden rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 sm:inline">
          Assistant
        </span>
        {/* Project color + status indicator */}
        {sessionId ? (
          <span
            className="mr-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{
              backgroundColor: exited ? "#ef4444" : (projectColor ?? "#22c55e"),
            }}
            title={
              exited ? "Exited" : (currentSession?.projectName ?? "Active")
            }
          />
        ) : (
          <span
            className="mr-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-neutral-600"
            title="No session"
          />
        )}

        <select
          value={sessionId ?? ""}
          onChange={(e) => {
            if (e.target.value) onSelectSession(e.target.value);
          }}
          className="min-w-0 flex-1 truncate rounded-full border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-900 outline-none focus:border-sky-400 sm:max-w-72 sm:flex-none"
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

        {currentSession && (
          <span
            className="hidden max-w-36 truncate rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 sm:inline"
            style={{ borderColor: projectColor ?? "#cbd5e1" }}
            title={currentSession.projectName}
          >
            {currentSession.projectName}
          </span>
        )}

        {sessionId && (
          <span
            className={`ml-1 hidden rounded-full px-1.5 py-0.5 text-xs sm:inline ${exited ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}
          >
            {exited ? "Exited" : "Active"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <span
            title="Drag pane from header"
            className="cursor-grab rounded px-1.5 py-0.5 text-sm text-slate-500"
          >
            ⠿
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSplit("horizontal");
            }}
            title="Split Horizontal"
            className="rounded px-1.5 py-0.5 text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-900"
          >
            ⎸
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSplit("vertical");
            }}
            title="Split Vertical"
            className="rounded px-1.5 py-0.5 text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-900"
          >
            ⎯
          </button>
          {canClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close Pane"
              className="rounded px-1.5 py-0.5 text-sm text-slate-500 hover:bg-red-100 hover:text-red-600"
            >
              ✕
            </button>
          )}
          {sessionId &&
            currentSession?.status === "active" &&
            onKillSession && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void onKillSession();
                }}
                title="Kill Session"
                className="rounded px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-red-100 hover:text-red-600"
              >
                Kill
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
          <div className="flex h-full items-center justify-center bg-slate-100">
            <p className="text-base font-medium text-slate-600">
              Select a session
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
