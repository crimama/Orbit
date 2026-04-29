"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AgentRunEventInfo,
  AgentRunInfo,
  AgentRunStatus,
  ApiError,
  ApiResponse,
} from "@/lib/types";

const RUNS_REFRESH_INTERVAL_MS = 5_000;
const EVENTS_REFRESH_INTERVAL_MS = 3_000;
const MAX_REFRESH_ATTEMPTS = 120;

const STATUS_STYLES: Record<AgentRunStatus, string> = {
  running: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  completed: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
  cancelled: "border-neutral-600 bg-neutral-800 text-neutral-300",
};

function formatTimeAgo(input: string): string {
  const createdAt = new Date(input);
  const diffSeconds = Math.round((createdAt.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 5) return "just now";

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, secondsPerUnit] of units) {
    if (absSeconds >= secondsPerUnit || unit === "second") {
      return formatter.format(Math.round(diffSeconds / secondsPerUnit), unit);
    }
  }

  return "just now";
}

function summarizePayload(payload: unknown): string {
  if (payload == null) return "No payload";
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object") return String(payload);

  const record = payload as Record<string, unknown>;
  const preferred = ["action", "message", "command", "status", "exitCode"];
  const parts = preferred
    .filter((key) => record[key] !== undefined)
    .map((key) => `${key}: ${String(record[key])}`);

  if (parts.length > 0) return parts.join(" · ");

  try {
    return JSON.stringify(payload);
  } catch {
    return "Structured payload";
  }
}

interface AgentRunsPanelProps {
  onNavigateSession?: (sessionId: string) => void;
}

export default function AgentRunsPanel({
  onNavigateSession,
}: AgentRunsPanelProps) {
  const [runs, setRuns] = useState<AgentRunInfo[]>([]);
  const [events, setEvents] = useState<AgentRunEventInfo[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let refreshAttempts = 0;

    async function loadRuns(showLoading: boolean) {
      if (showLoading) setLoadingRuns(true);

      try {
        const response = await fetch("/api/agent-runs?limit=8", {
          cache: "no-store",
        });
        const json = (await response.json()) as
          | ApiResponse<AgentRunInfo[]>
          | ApiError;

        if (cancelled) return;

        if (!response.ok || !("data" in json)) {
          setError("error" in json ? json.error : "Failed to load agent runs");
          return;
        }

        setError(null);
        setRuns(json.data);
        setSelectedRunId((current) => {
          if (current && json.data.some((run) => run.id === current)) {
            return current;
          }

          return json.data[0]?.id ?? null;
        });
      } catch {
        if (!cancelled) {
          setError("Failed to load agent runs");
        }
      } finally {
        if (!cancelled && showLoading) setLoadingRuns(false);
      }
    }

    const intervalId = window.setInterval(() => {
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        window.clearInterval(intervalId);
        return;
      }

      refreshAttempts += 1;
      void loadRuns(false);
    }, RUNS_REFRESH_INTERVAL_MS);

    void loadRuns(true);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }

    let cancelled = false;
    let refreshAttempts = 0;
    const runId = selectedRunId;

    async function loadEvents(showLoading: boolean) {
      if (showLoading) setLoadingEvents(true);

      try {
        const response = await fetch(
          `/api/agent-runs/${encodeURIComponent(runId)}/events?limit=12`,
          { cache: "no-store" },
        );
        const json = (await response.json()) as
          | ApiResponse<{ run: AgentRunInfo; events: AgentRunEventInfo[] }>
          | ApiError;

        if (cancelled) return;

        if (!response.ok || !("data" in json)) {
          setError("error" in json ? json.error : "Failed to load run events");
          return;
        }

        setError(null);
        setEvents(json.data.events);
      } catch {
        if (!cancelled) {
          setError("Failed to load run events");
        }
      } finally {
        if (!cancelled && showLoading) setLoadingEvents(false);
      }
    }

    const intervalId = window.setInterval(() => {
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        window.clearInterval(intervalId);
        return;
      }

      refreshAttempts += 1;
      void loadEvents(false);
    }, EVENTS_REFRESH_INTERVAL_MS);

    void loadEvents(true);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedRunId]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 text-neutral-100">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800/80 px-3 py-2">
        <div>
          <div className="text-xs font-medium text-neutral-300">Agent Runs</div>
          <div className="text-[10px] text-neutral-500">
            Durable run ledger and replay cursor preview
          </div>
        </div>
        <span className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400">
          {runs.length} recent
        </span>
      </div>

      {error ? (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="max-h-80 overflow-y-auto border-b border-neutral-800/60 md:border-b-0 md:border-r">
          {loadingRuns ? (
            <div className="px-3 py-4 text-xs text-neutral-500">
              Loading agent runs...
            </div>
          ) : null}

          {!loadingRuns && runs.length === 0 ? (
            <div className="px-3 py-4 text-xs text-neutral-500">
              No agent runs recorded yet. New sessions will appear here once the
              ledger receives events.
            </div>
          ) : null}

          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={`flex w-full items-start gap-2 border-b border-neutral-800/30 px-3 py-2 text-left transition hover:bg-neutral-800/40 ${
                selectedRunId === run.id ? "bg-neutral-800/50" : ""
              }`}
            >
              <span
                className={`mt-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase ${STATUS_STYLES[run.status]}`}
              >
                {run.status}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-neutral-200">
                  {run.title || run.runRef}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-neutral-500">
                  {run.agentType} · {run.eventCount} events · updated{" "}
                  {formatTimeAgo(run.updatedAt)}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {!selectedRun ? (
            <div className="px-3 py-4 text-xs text-neutral-500">
              Select a run to inspect replay events.
            </div>
          ) : (
            <>
              <div className="border-b border-neutral-800/60 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-neutral-200">
                      {selectedRun.title || selectedRun.runRef}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-neutral-500">
                      cursor: {events.at(-1)?.cursor ?? "none"}
                    </div>
                  </div>
                  {selectedRun.sessionId && onNavigateSession ? (
                    <button
                      onClick={() => onNavigateSession(selectedRun.sessionId!)}
                      className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-800"
                    >
                      Open session
                    </button>
                  ) : null}
                </div>
              </div>

              {loadingEvents ? (
                <div className="px-3 py-4 text-xs text-neutral-500">
                  Loading events...
                </div>
              ) : null}

              {!loadingEvents && events.length === 0 ? (
                <div className="px-3 py-4 text-xs text-neutral-500">
                  No replay events for this run yet.
                </div>
              ) : null}

              {!loadingEvents && events.length > 0 ? (
                <div className="relative">
                  <div className="pointer-events-none absolute bottom-0 left-[22px] top-0 w-px bg-neutral-800/60" />
                  {events.map((event) => (
                    <article
                      key={event.id}
                      className="relative flex gap-2.5 border-b border-neutral-800/30 px-3 py-2"
                    >
                      <div className="relative z-10 flex w-5 shrink-0 justify-center pt-0.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-[9px] font-semibold text-cyan-300">
                          {event.seq}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-xs text-neutral-200">
                            {event.type}
                          </span>
                          <time
                            dateTime={event.createdAt}
                            className="shrink-0 text-[10px] text-neutral-600"
                          >
                            {formatTimeAgo(event.createdAt)}
                          </time>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-neutral-500">
                          {summarizePayload(event.payload)}
                        </p>
                        {event.source ? (
                          <div className="mt-1 text-[10px] text-neutral-600">
                            source: {event.source}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
