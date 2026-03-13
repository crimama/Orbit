"use client";

import { useEffect, useRef, useState } from "react";

const BACKGROUND_DISCONNECT_DELAY_MS = 30_000;

function readVisibilityState(): DocumentVisibilityState {
  if (typeof document === "undefined") {
    return "visible";
  }

  return document.visibilityState;
}

export function usePageVisibility() {
  const [visibilityState, setVisibilityState] = useState<DocumentVisibilityState>(
    readVisibilityState,
  );
  const [hiddenSince, setHiddenSince] = useState<number | null>(null);
  const [backgrounded, setBackgrounded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearBackgroundTimer() {
      if (!timeoutRef.current) return;
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    function handleVisibilityChange() {
      const nextState = readVisibilityState();
      setVisibilityState(nextState);

      if (nextState === "hidden") {
        const startedAt = Date.now();
        setHiddenSince(startedAt);
        clearBackgroundTimer();
        timeoutRef.current = setTimeout(() => {
          setBackgrounded(true);
        }, BACKGROUND_DISCONNECT_DELAY_MS);
        return;
      }

      clearBackgroundTimer();
      setHiddenSince(null);
      setBackgrounded(false);
    }

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearBackgroundTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    visibilityState,
    hiddenSince,
    backgrounded,
    visible: visibilityState === "visible",
  };
}
