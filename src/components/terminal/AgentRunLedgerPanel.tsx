"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentRunEventInfo, AgentRunInfo, ApiResponse } from "@/lib/types";

interface AgentRunLedgerPanelProps {
  sessionId: string;
}

interface AgentRunEventsResponse {
  run: AgentRunInfo;
  events: AgentRunEventInfo[];
  nextCursor: string | null;
}

function formatEventPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return String(payload ?? "");
  const record = payload as Record<string, unknown>;
  if (typeof record.data === "string") {
    return record.data.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return JSON.stringify(record).slice(0, 120);
}

export default function AgentRunLedgerPanel({
  sessionId,
}: AgentRunLedgerPanelProps) {
  const [run, setRun] = useState<AgentRunInfo | null>(null);
  const [events, setEvents] = useState<AgentRunEventInfo[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cursor: string | null = null;

    async function loadInitialRun() {
      const res = await fetch(`/api/agent-runs?sessionId=${sessionId}&limit=1`);
      const json = (await res.json()) as ApiResponse<AgentRunInfo[]>;
      if (cancelled || !("data" in json)) return;
      const [nextRun] = json.data;
      setRun(nextRun ?? null);
      setEvents([]);
      cursor = null;
      if (nextRun) await loadEvents(nextRun.id);
    }

    async function loadEvents(runId: string) {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("after", cursor);
      const res = await fetch(`/api/agent-runs/${runId}/events?${params}`);
      const json = (await res.json()) as ApiResponse<AgentRunEventsResponse>;
      if (cancelled || !("data" in json)) return;
      setRun(json.data.run);
      if (json.data.events.length > 0) {
        cursor = json.data.nextCursor;
        setEvents((prev) => [...prev, ...json.data.events].slice(-200));
      }
    }

    void loadInitialRun();
    const timer = setInterval(() => {
      if (run?.id) void loadEvents(run.id);
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [run?.id, sessionId]);

  const displayEvents = useMemo(
    () => (expanded ? events.slice(-50) : events.slice(-6)),
    [events, expanded],
  );

  if (!run) return null;

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-700">AgentRun Ledger</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 font-mono text-slate-700">
          {run.id.slice(0, 8)}
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
          {run.status}
        </span>
        <span className="text-slate-600">
          {run.eventCount} persisted events
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="ml-auto text-slate-600 hover:text-slate-900"
        >
          {expanded ? "Collapse" : "Replay"}
        </button>
      </div>

      {displayEvents.length > 0 && (
        <div className="mt-2 space-y-1">
          {displayEvents.map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[3.5rem_8rem_1fr_auto] items-center gap-2 rounded-lg bg-white px-2 py-1 text-slate-700 shadow-sm"
            >
              <span className="font-mono text-slate-500">#{event.seq}</span>
              <span className="truncate font-medium">{event.type}</span>
              <span className="truncate text-slate-600">
                {formatEventPayload(event.payload)}
              </span>
              <span className="text-slate-400">
                {new Date(event.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
