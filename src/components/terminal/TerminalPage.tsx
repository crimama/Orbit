"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MultiTerminal from "./MultiTerminal";
import type { SessionInfo, ApiResponse } from "@/lib/types";

interface TerminalPageProps {
  sessionId: string;
  projectName?: string;
}

export default function TerminalPage({
  sessionId,
  projectName,
}: TerminalPageProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [jumpTarget, setJumpTarget] = useState(sessionId);

  useEffect(() => {
    setJumpTarget(sessionId);
  }, [sessionId]);

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
              prev.every((p, i) => p.id === next[i].id && p.status === next[i].status)
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

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-neutral-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded px-2 py-1 text-base text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            &larr; Back
          </button>
          <span className="min-w-0 truncate text-base text-neutral-100">
            {projectName && (
              <span className="text-neutral-300">{projectName} / </span>
            )}
            <span className="font-mono text-sm text-neutral-300">
              {sessionId.slice(0, 8)}
            </span>
          </span>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
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
              className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 focus:border-neutral-400 focus:outline-none sm:max-w-56 sm:flex-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id.slice(0, 8)} · {s.status}
                </option>
              ))}
            </select>
          )}
          <span className="hidden rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-sm text-neutral-200 sm:inline">
            Live
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2 sm:p-3">
        <div className="h-full overflow-hidden rounded border border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2 text-sm">
            <span className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-neutral-100">
              Session
            </span>
            <span className="text-neutral-300">Multi Terminal</span>
          </div>
          <div className="min-h-0 h-[calc(100%-37px)]">
            <MultiTerminal initialSessionId={sessionId} />
          </div>
        </div>
      </div>
    </div>
  );
}
