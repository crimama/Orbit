"use client";

import { useState } from "react";
import { useSessionMetrics } from "@/lib/hooks/useSessionMetrics";
import type { SessionEventType } from "@/lib/types";

interface SessionMetricsPanelProps {
  sessionId: string;
}

const EVENT_TYPE_CONFIG: Record<
  SessionEventType,
  { label: string; color: string }
> = {
  file_edit: { label: "Edit", color: "bg-blue-600" },
  command_run: { label: "Cmd", color: "bg-green-600" },
  test_result: { label: "Test", color: "bg-purple-600" },
  error: { label: "Err", color: "bg-red-600" },
  tool_call: { label: "Tool", color: "bg-yellow-600" },
  info: { label: "Info", color: "bg-neutral-600" },
};

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export default function SessionMetricsPanel({
  sessionId,
}: SessionMetricsPanelProps) {
  const snapshot = useSessionMetrics(sessionId);
  const [expanded, setExpanded] = useState(false);

  if (!snapshot || snapshot.metrics.totalEvents === 0) {
    return null;
  }

  const { metrics, recentEvents } = snapshot;
  const errorRatePercent = Math.round(metrics.errorRate * 100);
  const displayEvents = expanded
    ? recentEvents.slice(-20)
    : recentEvents.slice(-5);

  return (
    <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-700">Run Metrics</span>

        {(
          Object.entries(EVENT_TYPE_CONFIG) as [
            SessionEventType,
            (typeof EVENT_TYPE_CONFIG)[SessionEventType],
          ][]
        ).map(([type, cfg]) => {
          const count = metrics.eventCounts[type] ?? 0;
          if (count === 0) return null;
          return (
            <span
              key={type}
              className={`${cfg.color} rounded px-1.5 py-0.5 text-white`}
            >
              {cfg.label} {count}
            </span>
          );
        })}

        <span
          className={`rounded px-1.5 py-0.5 ${
            errorRatePercent > 20
              ? "bg-red-900 text-red-300"
              : "bg-white text-slate-700"
          }`}
        >
          Err {errorRatePercent}%
        </span>

        <span className="text-slate-700">
          {formatDuration(metrics.activeDurationMs)}
        </span>

        <button
          onClick={() => setExpanded((p) => !p)}
          className="ml-auto text-slate-600 hover:text-slate-900"
        >
          {expanded ? "Collapse" : "Expand"} ({recentEvents.length})
        </button>
      </div>

      {displayEvents.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {displayEvents.map((evt) => {
            const cfg = EVENT_TYPE_CONFIG[evt.type];
            return (
              <div
                key={evt.id}
                className="flex items-center gap-2 text-slate-700"
              >
                <span
                  className={`${cfg.color} inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full`}
                />
                <span className="truncate">{evt.summary}</span>
                <span className="ml-auto flex-shrink-0 text-slate-500">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
