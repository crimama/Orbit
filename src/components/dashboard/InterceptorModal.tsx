"use client";

import { useEffect, useState, useRef } from "react";
import { INTERCEPTOR_AUTO_DENY_MS } from "@/lib/constants";
import type { PendingApproval } from "@/lib/types";

interface InterceptorModalProps {
  approval: PendingApproval | null;
  onApprove: () => void;
  onDeny: () => void;
}

export default function InterceptorModal({
  approval,
  onApprove,
  onDeny,
}: InterceptorModalProps) {
  const [countdown, setCountdown] = useState(
    Math.ceil(INTERCEPTOR_AUTO_DENY_MS / 1000),
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!approval) return;

    const startTime = new Date(approval.timestamp).getTime();
    const totalMs = INTERCEPTOR_AUTO_DENY_MS;

    function updateCountdown() {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        onDeny();
      }
    }

    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [approval, onDeny]);

  if (!approval) return null;

  const severityColor =
    approval.matchedRule.severity === "block"
      ? "bg-red-600 text-red-100"
      : "bg-yellow-600 text-yellow-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-neutral-700 px-5 py-4">
          <svg
            className="h-5 w-5 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <h3 className="text-base font-semibold text-neutral-100">
            Command Intercepted
          </h3>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Command */}
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Command
            </span>
            <div className="mt-1 rounded bg-neutral-800 px-3 py-2 font-mono text-sm text-red-300">
              {approval.command}
            </div>
          </div>

          {/* Rule */}
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Matched Rule
            </span>
            <p className="mt-1 text-sm text-neutral-300">
              {approval.matchedRule.description}
            </p>
          </div>

          {/* Severity Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Severity
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${severityColor}`}
            >
              {approval.matchedRule.severity}
            </span>
          </div>

          {/* Countdown */}
          <div className="text-sm text-neutral-400">
            Auto-deny in:{" "}
            <span
              className={`font-mono font-bold ${countdown <= 10 ? "text-red-400" : "text-neutral-200"}`}
            >
              {countdown}s
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-neutral-700 px-5 py-3">
          <button
            onClick={onDeny}
            className="rounded bg-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-600"
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
