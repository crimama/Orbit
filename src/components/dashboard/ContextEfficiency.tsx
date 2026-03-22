"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiResponse, ApiError } from "@/lib/types";

interface CostEntry {
  sessionId: string;
  sessionName: string | null;
  agentType: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalEvents: number;
}

export default function ContextEfficiency() {
  const [data, setData] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/cost");
      const json = (await res.json()) as ApiResponse<{ sessions: CostEntry[] }> | ApiError;
      if ("data" in json) setData(json.data.sessions ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalTokens = data.reduce((s, d) => s + d.totalInputTokens + d.totalOutputTokens, 0);
  const totalCost = data.reduce((s, d) => s + d.totalCost, 0);
  const avgTokensPerSession = data.length > 0 ? Math.round(totalTokens / data.length) : 0;

  // Efficiency ranking: lower tokens per event = more efficient
  const ranked = data
    .filter((d) => d.totalEvents > 0)
    .map((d) => ({
      ...d,
      tokensPerEvent: Math.round((d.totalInputTokens + d.totalOutputTokens) / d.totalEvents),
    }))
    .sort((a, b) => a.tokensPerEvent - b.tokensPerEvent);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-neutral-100 shadow-sm">
      <h2 className="text-sm font-semibold">Context Efficiency</h2>
      <p className="mt-1 text-xs text-neutral-400">Token usage efficiency across sessions</p>

      {loading ? (
        <div className="mt-4 text-sm text-neutral-500">Loading...</div>
      ) : data.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950/50 px-4 py-6 text-center text-sm text-neutral-400">
          No token data yet. Run agent sessions to start tracking.
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
              <div className="text-[10px] uppercase text-neutral-500">Total Tokens</div>
              <div className="mt-1 text-lg font-semibold text-neutral-200">
                {totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
              <div className="text-[10px] uppercase text-neutral-500">Total Cost</div>
              <div className="mt-1 text-lg font-semibold text-green-400">
                ${totalCost.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
              <div className="text-[10px] uppercase text-neutral-500">Avg/Session</div>
              <div className="mt-1 text-lg font-semibold text-neutral-200">
                {avgTokensPerSession.toLocaleString()}
              </div>
            </div>
          </div>

          {ranked.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[10px] uppercase text-neutral-500">Efficiency Ranking (tokens/event)</div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {ranked.map((r, i) => (
                  <div
                    key={r.sessionId}
                    className="flex items-center justify-between rounded-lg border border-neutral-800/50 bg-neutral-950/50 px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${i === 0 ? "text-green-400" : i < 3 ? "text-neutral-300" : "text-neutral-500"}`}>
                        #{i + 1}
                      </span>
                      <span className="truncate text-xs text-neutral-300">
                        {r.sessionName || r.sessionId.slice(0, 8)}
                      </span>
                    </div>
                    <span className={`text-xs font-mono ${r.tokensPerEvent < avgTokensPerSession ? "text-green-400" : "text-amber-400"}`}>
                      {r.tokensPerEvent.toLocaleString()} t/e
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
