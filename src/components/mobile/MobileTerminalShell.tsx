"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TerminalView from "@/components/terminal/TerminalView";
import type { OrbitSocket } from "@/lib/socketClient";

interface MobileTerminalShellProps {
  sessionId: string;
  socket: OrbitSocket;
  connected: boolean;
  onExit: () => void;
}

const MIN_FONT_SIZE = 11;
const MAX_FONT_SIZE = 18;

const KEY_GROUPS: Array<
  Array<{
    label: string;
    value: string;
    wide?: boolean;
  }>
> = [
  [
    { label: "Esc", value: "\x1b" },
    { label: "Tab", value: "\t" },
    { label: "Ctrl+C", value: "\x03", wide: true },
    { label: "Ctrl+D", value: "\x04", wide: true },
    { label: "Ctrl+Z", value: "\x1a", wide: true },
    { label: "Enter", value: "\r", wide: true },
  ],
  [
    { label: "↑", value: "\x1b[A" },
    { label: "↓", value: "\x1b[B" },
    { label: "←", value: "\x1b[D" },
    { label: "→", value: "\x1b[C" },
    { label: "/", value: "/" },
    { label: "|", value: "|" },
    { label: "~", value: "~" },
    { label: "`", value: "`" },
    { label: "-", value: "-" },
  ],
];

export default function MobileTerminalShell({
  sessionId,
  socket,
  connected,
  onExit,
}: MobileTerminalShellProps) {
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [fontSize, setFontSize] = useState(12);
  const sendInputRef = useRef<((data: string) => void) | null>(null);

  const handleInputReady = useCallback(
    (sendInput: ((data: string) => void) | null) => {
      sendInputRef.current = sendInput;
    },
    [],
  );

  const sendRawInput = useCallback((data: string) => {
    sendInputRef.current?.(data);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const viewport = window.visualViewport;
    if (!viewport) {
      setKeyboardInset(0);
      return;
    }

    const updateInset = () => {
      const occupied = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setKeyboardInset(Math.round(occupied));
    };

    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    window.addEventListener("resize", updateInset);

    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      window.removeEventListener("resize", updateInset);
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div
        className="min-h-0 flex-1 overflow-hidden"
        style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
      >
        <TerminalView
          sessionId={sessionId}
          socket={socket}
          connected={connected}
          onExit={onExit}
          onInputReady={handleInputReady}
          fontSize={fontSize}
        />
      </div>

      <div className="safe-area-pb border-t border-neutral-800 bg-neutral-900 px-2 py-2">
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto">
          {KEY_GROUPS[0].map((key) => (
            <button
              key={key.label}
              type="button"
              onClick={() => sendRawInput(key.value)}
              className={`min-h-10 shrink-0 rounded-md bg-neutral-800 px-3 text-xs font-medium text-neutral-200 active:bg-neutral-700 ${
                key.wide ? "min-w-16" : "min-w-12"
              }`}
            >
              {key.label}
            </button>
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-neutral-800 pl-2">
            <button
              type="button"
              aria-label="Decrease terminal font size"
              onClick={() =>
                setFontSize((value) => Math.max(MIN_FONT_SIZE, value - 1))
              }
              className="min-h-10 min-w-10 rounded-md bg-neutral-800 text-sm font-semibold text-neutral-200 active:bg-neutral-700"
            >
              -
            </button>
            <span className="min-w-8 text-center text-xs text-neutral-500">
              {fontSize}
            </span>
            <button
              type="button"
              aria-label="Increase terminal font size"
              onClick={() =>
                setFontSize((value) => Math.min(MAX_FONT_SIZE, value + 1))
              }
              className="min-h-10 min-w-10 rounded-md bg-neutral-800 text-sm font-semibold text-neutral-200 active:bg-neutral-700"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {KEY_GROUPS[1].map((key) => (
            <button
              key={key.label}
              type="button"
              onClick={() => sendRawInput(key.value)}
              className="min-h-10 min-w-11 shrink-0 rounded-md bg-neutral-800 px-3 text-sm font-medium text-neutral-200 active:bg-neutral-700"
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
