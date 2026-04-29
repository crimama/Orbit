"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const STYLE_MAP: Record<ToastType, string> = {
  success: "border-emerald-700 bg-emerald-900/90 text-emerald-100",
  error: "border-red-700 bg-red-900/90 text-red-100",
  warning: "border-amber-700 bg-amber-900/90 text-amber-100",
  info: "border-cyan-700 bg-cyan-900/90 text-cyan-100",
};

const ICON_MAP: Record<ToastType, string> = {
  success: "[OK]",
  error: "[ERR]",
  warning: "[WARN]",
  info: "[INFO]",
};

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 10);
    const exitTimer = setTimeout(() => {
      setVisible(false);
    }, toast.duration - 300);
    const removeTimer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all duration-300 ${
        STYLE_MAP[toast.type]
      } ${visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
    >
      <span className="mt-0.5 shrink-0 font-bold" aria-hidden="true">
        {ICON_MAP[toast.type]}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-1 shrink-0 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  );
}
