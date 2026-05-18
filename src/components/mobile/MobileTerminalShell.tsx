"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TerminalView from "@/components/terminal/TerminalView";
import VirtualKeyboard from "@/components/mobile/VirtualKeyboard";
import type { OrbitSocket } from "@/lib/socketClient";

interface MobileTerminalShellProps {
  sessionId: string;
  socket: OrbitSocket;
  connected: boolean;
  onExit: () => void;
}

const MIN_FONT_SIZE = 11;
const MAX_FONT_SIZE = 18;

export default function MobileTerminalShell({
  sessionId,
  socket,
  connected,
  onExit,
}: MobileTerminalShellProps) {
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [fontSize, setFontSize] = useState(12);
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
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

  const sendComposedInput = useCallback(() => {
    if (!input) return;
    sendRawInput(input);
    setInput("");
  }, [input, sendRawInput]);

  const sendComposedLine = useCallback(() => {
    if (!input.trim()) return;
    sendRawInput(`${input}\r`);
    setInput("");
  }, [input, sendRawInput]);

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

      <div className="border-t border-neutral-800 bg-neutral-900 px-2 py-2">
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => sendRawInput("\x03")}
            className="min-h-10 shrink-0 rounded-md bg-neutral-800 px-3 text-xs font-medium text-neutral-200 active:bg-neutral-700"
          >
            Ctrl+C
          </button>
          <button
            type="button"
            onClick={() => sendRawInput("\t")}
            className="min-h-10 shrink-0 rounded-md bg-neutral-800 px-3 text-xs font-medium text-neutral-200 active:bg-neutral-700"
          >
            Tab
          </button>
          <button
            type="button"
            onClick={() => sendRawInput("\r")}
            className="min-h-10 shrink-0 rounded-md bg-neutral-800 px-3 text-xs font-medium text-neutral-200 active:bg-neutral-700"
          >
            Enter
          </button>
          <button
            type="button"
            onClick={() => sendRawInput("\x1b")}
            className="min-h-10 shrink-0 rounded-md bg-neutral-800 px-3 text-xs font-medium text-neutral-200 active:bg-neutral-700"
          >
            Esc
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
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

        <div className="flex items-end gap-1.5">
          <textarea
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (isComposing || event.nativeEvent.isComposing) return;

              const wantsNewline =
                event.altKey || event.nativeEvent.getModifierState("Alt");

              if (wantsNewline) return;

              event.preventDefault();
              event.stopPropagation();
              sendComposedLine();
            }}
            rows={1}
            placeholder="Type terminal input..."
            className="max-h-24 min-h-10 min-w-0 flex-1 resize-y rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-base leading-5 text-neutral-100 placeholder-neutral-500 outline-none focus:border-border-focus"
          />
          <button
            type="button"
            onClick={sendComposedInput}
            disabled={!input}
            className="min-h-10 rounded-md bg-neutral-800 px-3 text-xs font-semibold text-neutral-200 active:bg-neutral-700 disabled:opacity-40"
          >
            Raw
          </button>
          <button
            type="button"
            onClick={sendComposedLine}
            disabled={!input.trim()}
            className="min-h-10 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white active:bg-sky-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>

      <VirtualKeyboard visible defaultExpanded={false} onKey={sendRawInput} />
    </div>
  );
}
