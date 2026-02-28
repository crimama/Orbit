"use client";

import { useEffect, useState } from "react";
import type { SessionContextResource } from "@/lib/types";

interface SessionNextStepsProps {
  sessionId: string;
}

export default function SessionNextSteps({ sessionId }: SessionNextStepsProps) {
  const [context, setContext] = useState<SessionContextResource | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/resources/sessions/${sessionId}/context`);
        const json = (await res.json()) as { data?: SessionContextResource };
        if (!cancelled && json.data) {
          setContext(json.data);
        }
      } catch {
        if (!cancelled) {
          setContext(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!context || context.next.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
          Suggested Next Actions
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {context.next.map((item) => (
          <div
            key={item.uri}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
          >
            <p className="text-xs font-semibold text-slate-800">{item.title}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
