"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError, ApiResponse, SessionTokenInfo } from "@/lib/types";

type CostSessionEntry = SessionTokenInfo & {
  sessionName?: string | null;
  agentType?: string | null;
  totalTokens?: number | null;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

type PeriodFilter = "all" | "today" | "week" | "month";

type CostApiPayload =
  | CostSessionEntry[]
  | {
      totalCost?: number;
      sessions?: CostSessionEntry[];
    };

interface DashboardState {
  todayCost: number;
  weekCost: number;
  monthCost: number;
  sessions: CostSessionEntry[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const tokenFormatter = new Intl.NumberFormat("en-US");

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function normalizePayload(payload: CostApiPayload): { totalCost: number; sessions: CostSessionEntry[] } {
  if (Array.isArray(payload)) {
    return {
      totalCost: payload.reduce((sum, session) => sum + session.totalCost, 0),
      sessions: payload,
    };
  }

  return {
    totalCost:
      payload.totalCost ?? payload.sessions?.reduce((sum, session) => sum + session.totalCost, 0) ?? 0,
    sessions: payload.sessions ?? [],
  };
}

function buildQuery(params?: { from?: Date; to?: Date }) {
  const searchParams = new URLSearchParams();

  if (params?.from) {
    searchParams.set("from", params.from.toISOString());
  }

  if (params?.to) {
    searchParams.set("to", params.to.toISOString());
  }

  const query = searchParams.toString();
  return query ? `/api/analytics/cost?${query}` : "/api/analytics/cost";
}

async function fetchCost(params?: { from?: Date; to?: Date }, signal?: AbortSignal) {
  const response = await fetch(buildQuery(params), {
    cache: "no-store",
    signal,
  });
  const json = (await response.json()) as ApiResponse<CostApiPayload> | ApiError;

  if (!response.ok || !("data" in json)) {
    throw new Error("error" in json ? json.error : "Failed to load cost analytics");
  }

  return normalizePayload(json.data);
}

export default function CostDashboard() {
  const [dashboard, setDashboard] = useState<DashboardState>({
    todayCost: 0,
    weekCost: 0,
    monthCost: 0,
    sessions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const allData = await fetchCost(undefined, signal);
      const sessions = allData.sessions;

      // Find the latest session date as reference point
      // (Claude dashboard.db may not have today's data if running via Orbit PTY)
      let latestMs = 0;
      for (const s of sessions) {
        const ms = new Date(s.modifiedAt ?? s.createdAt ?? "").getTime();
        if (!Number.isNaN(ms) && ms > latestMs) latestMs = ms;
      }
      const ref = latestMs > 0 ? new Date(latestMs) : new Date();
      const dayStart = startOfDay(ref).getTime();
      const weekStart = startOfWeek(ref).getTime();
      const monthStart = startOfMonth(ref).getTime();

      let todayCost = 0, weekCost = 0, monthCost = 0;
      for (const s of sessions) {
        const mod = new Date(s.modifiedAt ?? s.createdAt ?? "").getTime();
        if (Number.isNaN(mod)) continue;
        if (mod >= dayStart) todayCost += s.totalCost;
        if (mod >= weekStart) weekCost += s.totalCost;
        if (mod >= monthStart) monthCost += s.totalCost;
      }

      setDashboard({ todayCost, weekCost, monthCost, sessions });
    } catch (loadError) {
      if (signal?.aborted) {
        return;
      }

      setDashboard({
        todayCost: 0,
        weekCost: 0,
        monthCost: 0,
        sessions: [],
      });
      setError(loadError instanceof Error ? loadError.message : "Failed to load cost analytics");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  const [showAll, setShowAll] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const totalCost = dashboard.sessions.reduce((s, e) => s + e.totalCost, 0);
  const summaryCards = [
    { label: "Total", value: totalCost },
    { label: "Daily", value: dashboard.todayCost },
    { label: "Weekly", value: dashboard.weekCost },
    { label: "Monthly", value: dashboard.monthCost },
  ];

  const filteredSessions = (() => {
    if (period === "all") return dashboard.sessions;
    // Use latest session date as reference (same as summary cards)
    let latestMs = 0;
    for (const s of dashboard.sessions) {
      const ms = new Date(s.modifiedAt ?? s.createdAt ?? "").getTime();
      if (!Number.isNaN(ms) && ms > latestMs) latestMs = ms;
    }
    const ref = latestMs > 0 ? new Date(latestMs) : new Date();
    const cutoff =
      period === "today" ? startOfDay(ref).getTime()
      : period === "week" ? startOfWeek(ref).getTime()
      : startOfMonth(ref).getTime();
    return dashboard.sessions.filter((s) => {
      const mod = new Date(s.modifiedAt ?? s.createdAt ?? "").getTime();
      return !Number.isNaN(mod) && mod >= cutoff;
    });
  })();

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-3 text-neutral-100 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-neutral-100">Cost</h2>
          {!loading && (
            <div className="flex items-center gap-3 text-[11px]">
              {summaryCards.map((card) => (
                <span key={card.label} className="text-neutral-400">
                  {card.label} <span className="font-medium text-amber-400">{currencyFormatter.format(card.value)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-[10px] text-neutral-500 hover:text-neutral-300"
        >
          {showAll ? "Hide" : "Detail"}
        </button>
      </div>

      {error ? (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      {showAll && (
      <div className="mt-2">
        <div className="mb-2 flex gap-1">
          {(["all", "today", "week", "month"] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-0.5 text-[10px] ${
                period === p
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {p === "all" ? "All" : p === "today" ? "Today" : p === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-400">
            비용 데이터를 불러오는 중입니다...
          </div>
        ) : null}

        {!loading && filteredSessions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950/50 px-4 py-8 text-center text-sm text-neutral-300">
            토큰 추적 데이터가 아직 없습니다
          </div>
        ) : null}

        {!loading && filteredSessions.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-800 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="pb-3 pr-4 font-medium">세션명</th>
                  <th className="pb-3 pr-4 font-medium">프로젝트</th>
                  <th className="pb-3 pr-4 font-medium">날짜</th>
                  <th className="pb-3 pr-4 font-medium">토큰</th>
                  <th className="pb-3 font-medium">비용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {(() => {
                  const sorted = filteredSessions.slice().sort((a, b) => b.totalCost - a.totalCost);
                  const visible = sorted.slice(0, 15);

                  return (
                    <>
                      {visible.map((session) => {
                        const totalTokens =
                          session.totalTokens ??
                          session.totalInputTokens + session.totalOutputTokens;
                        const sessionName = session.sessionName?.trim() || session.sessionId;
                        const raw = session as unknown as { projectName?: string; modifiedAt?: string; createdAt?: string };
                        const projectName = raw.projectName || "-";
                        const dateStr = raw.modifiedAt || raw.createdAt || "";
                        const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

                        return (
                          <tr key={session.sessionId} className="text-neutral-200">
                            <td className="py-2 pr-4">
                              <div className="max-w-[400px] truncate text-xs text-neutral-100">
                                {sessionName}
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-[11px] text-neutral-400">{projectName}</td>
                            <td className="py-2 pr-4 text-[10px] text-neutral-500">{dateFormatted}</td>
                            <td className="py-2 pr-4 text-[11px] text-neutral-300">
                              {tokenFormatter.format(totalTokens)}
                            </td>
                            <td className="py-2 text-[11px] font-medium text-amber-400">
                              {currencyFormatter.format(session.totalCost)}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      )}
    </section>
  );
}
