"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TerminalView from "@/components/terminal/TerminalView";
import { createTerminalSocket, type OrbitSocket } from "@/lib/socketClient";
import type { SessionInfo, ApiResponse } from "@/lib/types";

interface ABCompareProps {
  leftSessionId: string | null;
  rightSessionId: string | null;
}

export default function ABCompare({
  leftSessionId: initialLeft,
  rightSessionId: initialRight,
}: ABCompareProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [leftId, setLeftId] = useState<string | null>(initialLeft);
  const [rightId, setRightId] = useState<string | null>(initialRight);

  // Independent sockets for each panel
  const leftSocketRef = useRef<OrbitSocket | null>(null);
  const rightSocketRef = useRef<OrbitSocket | null>(null);
  const [leftConnected, setLeftConnected] = useState(false);
  const [rightConnected, setRightConnected] = useState(false);

  useEffect(() => {
    const left = createTerminalSocket();
    const right = createTerminalSocket();
    leftSocketRef.current = left;
    rightSocketRef.current = right;

    left.on("connect", () => setLeftConnected(true));
    left.on("disconnect", () => setLeftConnected(false));
    right.on("connect", () => setRightConnected(true));
    right.on("disconnect", () => setRightConnected(false));

    if (left.connected) setLeftConnected(true);
    if (right.connected) setRightConnected(true);

    return () => {
      left.disconnect();
      right.disconnect();
    };
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const json = (await res.json()) as ApiResponse<SessionInfo[]>;
      if ("data" in json) {
        setSessions(json.data);
      }
    } catch {
      // Silently handle fetch error
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Left selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-400">Left:</label>
          <select
            value={leftId ?? ""}
            onChange={(e) => setLeftId(e.target.value || null)}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200 outline-none focus:border-neutral-500"
          >
            <option value="">Select session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.projectName} / {s.agentType} ({s.id.slice(0, 8)})
              </option>
            ))}
          </select>
        </div>

        {/* Right selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-400">
            Right:
          </label>
          <select
            value={rightId ?? ""}
            onChange={(e) => setRightId(e.target.value || null)}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-200 outline-none focus:border-neutral-500"
          >
            <option value="">Select session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.projectName} / {s.agentType} ({s.id.slice(0, 8)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Terminal Panels */}
      <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
        {/* Left terminal */}
        <div className="flex flex-1 flex-col border-b border-neutral-800 sm:border-b-0 sm:border-r">
          <div className="border-b border-neutral-800 px-3 py-1.5">
            <span className="text-xs text-neutral-500">
              {leftId ? `Session ${leftId.slice(0, 8)}` : "No session selected"}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            {leftId && leftSocketRef.current ? (
              <TerminalView
                key={leftId}
                sessionId={leftId}
                socket={leftSocketRef.current}
                connected={leftConnected}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
                <p className="text-sm text-neutral-600">
                  Select a session for the left panel
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right terminal */}
        <div className="flex flex-1 flex-col">
          <div className="border-b border-neutral-800 px-3 py-1.5">
            <span className="text-xs text-neutral-500">
              {rightId
                ? `Session ${rightId.slice(0, 8)}`
                : "No session selected"}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            {rightId && rightSocketRef.current ? (
              <TerminalView
                key={rightId}
                sessionId={rightId}
                socket={rightSocketRef.current}
                connected={rightConnected}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
                <p className="text-sm text-neutral-600">
                  Select a session for the right panel
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
