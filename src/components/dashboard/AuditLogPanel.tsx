"use client";

import { useEffect, useState } from "react";
import type { AuditLogInfo, ApiResponse, ApiError } from "@/lib/types";

type AuditFilterValue =
  | "all"
  | "interceptor"
  | "session"
  | "agent_activity";

const FILTER_OPTIONS: Array<{ value: AuditFilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "interceptor", label: "Permissions" },
  { value: "session", label: "Sessions" },
  { value: "agent_activity", label: "Agent Activity" },
];

const FILTER_EVENT_TYPES: Record<Exclude<AuditFilterValue, "all">, string[]> = {
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
  onNavigateSession?: (sessionId: string) => void;
}

export default function AuditLogPanel({ onNavigateSession }: AuditLogPanelProps = {}) {
  const [logs, setLogs] = useState<AuditLogInfo[]>([]);
  const [filter, setFilter] = useState<AuditFilterValue>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/90 text-neutral-100 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Audit Log</h2>
          <p className="mt-1 text-xs text-neutral-400">
            최근 감사 이벤트를 타입별로 확인합니다.
          </p>
        </div>

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as AuditFilterValue)}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-xs text-neutral-200 outline-none transition focus:border-neutral-500"
          aria-label="Audit event type filter"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-sm text-neutral-400">
            감사 로그를 불러오는 중...
          </div>
        ) : null}

        {(() => {
          const filtered = filter === "all"
            ? logs
            : logs.filter((l) => FILTER_EVENT_TYPES[filter]?.includes(l.eventType));

          if (!loading && filtered.length === 0) {
            return (
              <div className="px-4 py-6 text-sm text-neutral-400">
                감사 로그가 없습니다
              </div>
            );
          }

          if (loading || filtered.length === 0) return null;

          return (
          <div className="relative">
            <div className="pointer-events-none absolute bottom-0 left-7 top-0 w-px bg-neutral-800/80" />
            {filtered.map((log) => {
              const eventStyle = getEventStyle(log.eventType);

              return (
                <article
                  key={log.id}
                  className={`relative flex gap-3 border-b border-neutral-800/50 px-3 py-2 ${
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
                  <div className="relative z-10 flex w-8 shrink-0 justify-center pt-0.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${eventStyle.dotClassName}`}
                      aria-hidden="true"
                    >
                      {eventStyle.symbol}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {log.projectName && (
                          <span className="mr-1.5 inline-flex items-center gap-1 text-[10px] text-neutral-400">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: log.projectColor ?? "#64748b" }}
                            />
                            {log.projectName}
                          </span>
                        )}
                        <span className="text-sm text-neutral-100">
                          {log.action}
                        </span>
                      </div>
                      <time
                        dateTime={log.createdAt}
                        className="shrink-0 text-[11px] text-neutral-500"
                      >
                        {formatTimeAgo(log.createdAt)}
                      </time>
                    </div>

                    {log.detail ? (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-400">
                        {log.detail}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          );
        })()}
      </div>
    </section>
  );
}
