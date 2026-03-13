"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMobile } from "@/lib/hooks/useMobile";

interface MobileLayoutProps {
  children: ReactNode;
}

const statusTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function MobileLayout({ children }: MobileLayoutProps) {
  const { isMobile, isStandalone } = useMobile();
  const [isOnline, setIsOnline] = useState(true);
  const [title, setTitle] = useState("Agent Orbit");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function syncStatusBarState() {
      setIsOnline(window.navigator.onLine);
      setTitle(document.title.trim() || "Agent Orbit");
      setCurrentTime(statusTimeFormatter.format(new Date()));
    }

    const timer = window.setInterval(syncStatusBarState, 30_000);

    window.addEventListener("online", syncStatusBarState);
    window.addEventListener("offline", syncStatusBarState);
    window.addEventListener("focus", syncStatusBarState);
    document.addEventListener("visibilitychange", syncStatusBarState);

    syncStatusBarState();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", syncStatusBarState);
      window.removeEventListener("offline", syncStatusBarState);
      window.removeEventListener("focus", syncStatusBarState);
      document.removeEventListener("visibilitychange", syncStatusBarState);
    };
  }, []);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div
      className="flex h-[100dvh] flex-col bg-neutral-950"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {isStandalone ? (
        <div className="flex h-7 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3 text-[11px] text-neutral-200">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline ? "bg-emerald-400" : "bg-red-500"
              }`}
            />
            <span className="text-neutral-400">
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <div className="truncate px-3 text-center font-medium text-neutral-100">
            {title}
          </div>
          <div className="min-w-[40px] text-right font-mono text-neutral-400">
            {currentTime}
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
