"use client";

import { useEffect, useState } from "react";
import type { AuditLogInfo, SessionInfo, ApiResponse, ApiError } from "@/lib/types";

type AuditFilterValue =
  | "all"
  | "live"
  | "interceptor"
  | "session"
  | "agent_activity";

const FILTER_OPTIONS: Array<{ value: AuditFilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "interceptor", label: "Permissions" },
  { value: "session", label: "Sessions" },
  { value: "agent_activity", label: "Agent Activity" },
];

const FILTER_EVENT_TYPES: Record<
  Exclude<AuditFilterValue, "all" | "live">,
  string[]
> = {
  interceptor: ["interceptor_approve", "interceptor_deny", "interceptor_pending"],
  session: ["session_create", "session_terminate", "session_fork"],
  agent_activity: ["session_event_error", "session_event_tool", "session_event_command"],
};

const EVENT_STYLES: Record<string, { dotClassName: string; symbol: string }> = {
  interceptor_approve: {
    dotClassName: "border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
    symbol: "✓",
  },
  interceptor_deny: {
    dotClassName: "border-red-500/40 bg-red-500/20 text-red-300",
    symbol: "✕",
  },
  interceptor_pending: {
    dotClassName: "border-amber-500/40 bg-amber-500/20 text-amber-300",
    symbol: "?",
  },
  session_create: {
    dotClassName: "border-sky-500/40 bg-sky-500/20 text-sky-300",
    symbol: "▶",
  },
  session_terminate: {
    dotClassName: "border-neutral-600 bg-neutral-800 text-neutral-300",
    symbol: "■",
  },
  session_event_error: {
    dotClassName: "border-red-500/40 bg-red-500/20 text-red-300",
    symbol: "!",
  },
  session_event_tool: {
    dotClassName: "border-purple-500/40 bg-purple-500/20 text-purple-300",
    symbol: "⚡",
  },
  session_event_command: {
    dotClassName: "border-cyan-500/40 bg-cyan-500/20 text-cyan-300",
    symbol: "$",
  },
};

function formatTimeAgo(input: string): string {
  const createdAt = new Date(input);
  const diffSeconds = Math.round((createdAt.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 5) return "just now";

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, secondsPerUnit] of units) {
    if (absSeconds >= secondsPerUnit || unit === "second") {
      return formatter.format(
        Math.round(diffSeconds / secondsPerUnit),
        unit,
      );
    }
  }

  return "just now";
}

function getEventStyle(eventType: string) {
  return EVENT_STYLES[eventType] ?? {
    dotClassName: "border-neutral-700 bg-neutral-800 text-neutral-300",
    symbol: "•",
  };
}

interface AuditLogPanelProps {
  activeSessions?: SessionInfo[];
  onNavigateSession?: (sessionId: string) => void;
}

export default function AuditLogPanel({
  activeSessions = [],
  onNavigateSession,
}: AuditLogPanelProps) {
  const [logs, setLogs] = useState<AuditLogInfo[]>([]);
  const [filter, setFilter] = useState<AuditFilterValue>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filter === "live") {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadLogs() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ limit: "100" });

        const response = await fetch(`/api/audit?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await response.json()) as ApiResponse<AuditLogInfo[]> | ApiError;

        if (cancelled) return;

        if (!response.ok || !("data" in json)) {
          setLogs([]);
          setError("error" in json ? json.error : "Failed to load audit logs");
          return;
        }

        setLogs(json.data as AuditLogInfo[]);
      } catch {
        if (!cancelled) {
          setLogs([]);
          setError("Failed to load audit logs");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const showLiveSessions =
    activeSessions.length > 0 && (filter === "all" || filter === "live");

  const filtered =
    filter === "all" || filter === "live"
      ? logs
      : logs.filter((l) =>
          FILTER_EVENT_TYPES[filter]?.includes(l.eventType),
        );

  const showAuditEvents = filter !== "live";
  const isEmpty = !showLiveSessions && !loading && filtered.length === 0;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 text-neutral-100">
      {/* Header with pill filter tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800/80 px-3 py-2">
        <span className="text-xs font-medium text-neutral-400">Activity</span>
        <div className="flex items-center gap-0.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                filter === opt.value
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {opt.label}
              {opt.value === "live" && activeSessions.length > 0 && (
                <span className="ml-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[9px] text-emerald-400">
                  {activeSessions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      <div className="max-h-96 overflow-y-auto">
        {/* Live sessions — pinned at top */}
        {showLiveSessions && (
          <div className="border-b border-neutral-800/50">
            {activeSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onNavigateSession?.(s.id)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-neutral-800/40"
              >
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mr-1.5 inline-flex items-center gap-1 text-[10px] text-neutral-400">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: s.projectColor }}
                    />
                    {s.projectName}
                  </span>
                  <span className="text-xs text-neutral-200">
                    {s.name ?? `${s.agentType} ${s.id.slice(0, 6)}`}
                  </span>
                </span>
                <span className="text-[10px] text-emerald-400/70">live</span>
              </button>
            ))}
          </div>
        )}

        {/* Audit timeline */}
        {showAuditEvents && (
          <>
            {loading ? (
              <div className="px-3 py-4 text-xs text-neutral-500">
                Loading...
              </div>
            ) : null}

            {isEmpty && (
              <div className="px-3 py-4 text-xs text-neutral-500">
                No activity yet.
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="relative">
                <div className="pointer-events-none absolute bottom-0 left-[18px] top-0 w-px bg-neutral-800/60" />
                {filtered.map((log) => {
                  const eventStyle = getEventStyle(log.eventType);
                  return (
                    <article
                      key={log.id}
                      className={`relative flex gap-2.5 border-b border-neutral-800/30 px-3 py-1.5 ${
                        log.sessionId && onNavigateSession
                          ? "cursor-pointer transition hover:bg-neutral-800/40"
                          : ""
                      }`}
                      onClick={() => {
                        if (log.sessionId && onNavigateSession) {
                          onNavigateSession(log.sessionId);
                        }
                      }}
                    >
                      <div className="relative z-10 flex w-5 shrink-0 justify-center pt-0.5">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-semibold ${eventStyle.dotClassName}`}
                          aria-hidden="true"
                        >
                          {eventStyle.symbol}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {log.projectName && (
                              <span className="mr-1 inline-flex items-center gap-1 text-[10px] text-neutral-500">
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: log.projectColor ?? "#64748b" }}
                                />
                                {log.projectName}
                              </span>
                            )}
                            <span className="text-xs text-neutral-200">
                              {log.action}
                            </span>
                          </div>
                          <time
                            dateTime={log.createdAt}
                            className="shrink-0 text-[10px] text-neutral-600"
                          >
                            {formatTimeAgo(log.createdAt)}
                          </time>
                        </div>

                        {log.detail ? (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
                            {log.detail}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Live-only empty state */}
        {filter === "live" && activeSessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-neutral-500">
            No active sessions.
          </div>
        )}
      </div>
    </section>
  );
}
