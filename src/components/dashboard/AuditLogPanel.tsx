"use client";

import { useEffect, useState } from "react";
import type { AuditLogInfo, ApiResponse, ApiError } from "@/lib/types";

type AuditFilterValue =
  | "all"
  | "interceptor_approve"
  | "interceptor_deny"
  | "session_create"
  | "session_terminate";

const FILTER_OPTIONS: Array<{ value: AuditFilterValue; label: string }> = [
  { value: "all", label: "All events" },
  { value: "interceptor_approve", label: "Interceptor approve" },
  { value: "interceptor_deny", label: "Interceptor deny" },
  { value: "session_create", label: "Session create" },
  { value: "session_terminate", label: "Session terminate" },
];

const EVENT_STYLES: Record<
  Exclude<AuditFilterValue, "all">,
  { dotClassName: string; symbol: string }
> = {
  interceptor_approve: {
    dotClassName: "border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
    symbol: "+",
  },
  interceptor_deny: {
    dotClassName: "border-red-500/40 bg-red-500/20 text-red-300",
    symbol: "x",
  },
  session_create: {
    dotClassName: "border-sky-500/40 bg-sky-500/20 text-sky-300",
    symbol: ">",
  },
  session_terminate: {
    dotClassName: "border-neutral-600 bg-neutral-800 text-neutral-300",
    symbol: "-",
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

function getEventStyle(eventType: AuditLogInfo["eventType"]) {
  if (eventType in EVENT_STYLES) {
    return EVENT_STYLES[eventType as keyof typeof EVENT_STYLES];
  }

  return {
    dotClassName: "border-neutral-700 bg-neutral-800 text-neutral-300",
    symbol: "•",
  };
}

export default function AuditLogPanel() {
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
        const params = new URLSearchParams({ limit: "30" });

        if (filter !== "all") {
          params.set("eventType", filter);
        }

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

        setLogs(json.data);
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

        {!loading && logs.length === 0 ? (
          <div className="px-4 py-6 text-sm text-neutral-400">
            감사 로그가 없습니다
          </div>
        ) : null}

        {!loading && logs.length > 0 ? (
          <div className="relative">
            <div className="pointer-events-none absolute bottom-0 left-7 top-0 w-px bg-neutral-800/80" />
            {logs.map((log) => {
              const eventStyle = getEventStyle(log.eventType);

              return (
                <article
                  key={log.id}
                  className="relative flex gap-3 border-b border-neutral-800/50 px-3 py-2"
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
                      <p className="min-w-0 text-sm text-neutral-100">
                        {log.action}
                      </p>
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
        ) : null}
      </div>
    </section>
  );
}
