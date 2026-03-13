"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import pako from "pako";
import type { OrbitSocket } from "@/lib/socketClient";
import { useSocket } from "@/lib/useSocket";

interface TerminalViewProps {
  sessionId: string;
  socket?: OrbitSocket;
  connected?: boolean;
  onExit?: (exitCode: number) => void;
  onInputReady?: (sendInput: ((data: string) => void) | null) => void;
  fontSize?: number;
  disableStdin?: boolean;
}

const TOUCH_TAP_THRESHOLD_PX = 10;
const SKELETON_BARS = [44, 72, 58, 80, 36];

type WebglState = "idle" | "active" | "fallback";

export default function TerminalView({
  sessionId,
  socket,
  connected,
  onExit,
  onInputReady,
  fontSize = 14,
  disableStdin = false,
}: TerminalViewProps) {
  const { socket: fallbackSocket, connected: fallbackConnected } = useSocket();
  const activeSocket = socket ?? fallbackSocket;
  const activeConnected = connected ?? fallbackConnected;
  const [ready, setReady] = useState(false);
  const [webglState, setWebglState] = useState<WebglState>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const webglAddonRef = useRef<{ dispose(): void } | null>(null);
  const attachedRef = useRef(false);
  const onExitRef = useRef(onExit);
  const fontSizeRef = useRef(fontSize);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    fontSizeRef.current = fontSize;
  }, [fontSize]);

  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return;
    fitAddonRef.current.fit();
    if (activeSocket && attachedRef.current) {
      activeSocket.emit("terminal-resize", {
        cols: termRef.current.cols,
        rows: termRef.current.rows,
      });
    }
  }, [activeSocket]);

  useEffect(() => {
    if (!containerRef.current || !activeSocket || !activeConnected) return;
    const socket = activeSocket;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let termDataDisposable: { dispose(): void } | null = null;
    let detachTouchHandlers: (() => void) | null = null;
    let detachWebglLossListener: (() => void) | null = null;

    setReady(false);
    setWebglState("idle");

    const onSessionReady = (sid: string) => {
      if (sid === sessionId) setReady(true);
    };
    socket.on("session-ready", onSessionReady);

    // Fallback: force ready after 5s
    const readyFallback = setTimeout(() => setReady(true), 5_000);

    const onTerminalData = (data: string) => {
      termRef.current?.write(data);
    };

    const onCompressedData = (data: Buffer) => {
      const inflated = pako.inflate(new Uint8Array(data), { to: "string" });
      termRef.current?.write(inflated);
    };

    const onSessionExit = (sid: string, exitCode: number) => {
      // Ignore exit events for other sessions on shared socket.
      if (sid !== sessionId) return;
      termRef.current?.write(
        `\r\n\x1b[33m[Session exited: ${exitCode}]\x1b[0m\r\n`,
      );
      attachedRef.current = false;
      onExitRef.current?.(exitCode);
    };

    const sendInput = (data: string) => {
      socket.emit("terminal-data", data);
    };

    const getArrowSequence = (term: import("@xterm/xterm").Terminal, direction: "up" | "down" | "left" | "right") => {
      const applicationCursorKeysMode = (
        term as import("@xterm/xterm").Terminal & {
          modes?: { applicationCursorKeysMode?: boolean };
        }
      ).modes?.applicationCursorKeysMode;

      if (applicationCursorKeysMode) {
        switch (direction) {
          case "up":
            return "\x1bOA";
          case "down":
            return "\x1bOB";
          case "right":
            return "\x1bOC";
          case "left":
            return "\x1bOD";
        }
      }

      switch (direction) {
        case "up":
          return "\x1b[A";
        case "down":
          return "\x1b[B";
        case "right":
          return "\x1b[C";
        case "left":
          return "\x1b[D";
      }
    };

    const moveCursorToTouch = (clientX: number, clientY: number) => {
      const term = termRef.current;
      const container = containerRef.current;
      if (!term || !container || disableStdin) return;

      const canvas =
        container.querySelector(".xterm-screen canvas") ??
        term.element?.querySelector("canvas");
      const rect =
        canvas?.getBoundingClientRect() ??
        term.element?.getBoundingClientRect() ??
        container.getBoundingClientRect();

      const cellWidth = rect.width / Math.max(term.cols, 1);
      const cellHeight = rect.height / Math.max(term.rows, 1);
      if (!Number.isFinite(cellWidth) || !Number.isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) {
        return;
      }

      const targetCol = Math.max(
        0,
        Math.min(term.cols - 1, Math.floor((clientX - rect.left) / cellWidth)),
      );
      const targetRow = Math.max(
        0,
        Math.min(term.rows - 1, Math.floor((clientY - rect.top) / cellHeight)),
      );

      const buffer = term.buffer.active;
      const deltaRow = targetRow - buffer.cursorY;
      const deltaCol = targetCol - buffer.cursorX;

      if (deltaRow === 0 && deltaCol === 0) {
        term.focus();
        return;
      }

      const payload =
        getArrowSequence(term, deltaRow < 0 ? "up" : "down").repeat(Math.abs(deltaRow)) +
        getArrowSequence(term, deltaCol < 0 ? "left" : "right").repeat(Math.abs(deltaCol));

      term.focus();
      sendInput(payload);
    };

    const bindTouchCursorMove = () => {
      const term = termRef.current;
      const container = containerRef.current;
      const target = term?.element ?? container;
      if (!target) return;

      const onTouchStart = (event: TouchEvent) => {
        if (event.touches.length !== 1) {
          touchStartRef.current = null;
          return;
        }

        const touch = event.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      };

      const onTouchEnd = (event: TouchEvent) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;

        if (!start || event.changedTouches.length !== 1) return;

        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;

        if (
          Math.abs(dx) > TOUCH_TAP_THRESHOLD_PX ||
          Math.abs(dy) > TOUCH_TAP_THRESHOLD_PX
        ) {
          return;
        }

        moveCursorToTouch(touch.clientX, touch.clientY);
      };

      target.addEventListener("touchstart", onTouchStart, { passive: true });
      target.addEventListener("touchend", onTouchEnd, { passive: true });

      return () => {
        target.removeEventListener("touchstart", onTouchStart);
        target.removeEventListener("touchend", onTouchEnd);
      };
    };

    const enableCanvasFallback = (reason: string) => {
      if (webglAddonRef.current) {
        webglAddonRef.current.dispose();
        webglAddonRef.current = null;
      }

      detachWebglLossListener?.();
      detachWebglLossListener = null;
      setWebglState("fallback");
      console.warn("[TerminalView] WebGL fallback active", { sessionId, reason });
    };

    const initWebgl = async (term: import("@xterm/xterm").Terminal) => {
      try {
        const { WebglAddon } = await import("@xterm/addon-webgl");
        if (disposed) return;

        const addon = new WebglAddon();
        term.loadAddon(addon);
        webglAddonRef.current = addon;
        setWebglState("active");
        console.info("[TerminalView] WebGL renderer active", { sessionId });

        const canvas =
          containerRef.current?.querySelector(".xterm-screen canvas") ??
          term.element?.querySelector("canvas");

        if (canvas instanceof HTMLCanvasElement) {
          const onContextLost = (event: Event) => {
            event.preventDefault();
            enableCanvasFallback("webglcontextlost");
          };

          canvas.addEventListener("webglcontextlost", onContextLost, false);
          detachWebglLossListener = () => {
            canvas.removeEventListener("webglcontextlost", onContextLost, false);
          };
        }
      } catch (error) {
        console.warn("[TerminalView] WebGL renderer unavailable, using canvas fallback", {
          sessionId,
          error,
        });
        setWebglState("fallback");
      }
    };

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        scrollback: 50_000,
        fontSize: fontSizeRef.current,
        lineHeight: 1.45,
        fontWeight: "500",
        fontWeightBold: "700",
        fontFamily:
          '"JetBrains Mono", "Cascadia Mono", "SF Mono", "Consolas", "Menlo", ui-monospace, monospace',
        minimumContrastRatio: 4.5,
        theme: {
          background: "#0b1220",
          foreground: "#e6edf3",
          cursor: "#93c5fd",
          selectionBackground: "#334155",
        },
        allowProposedApi: true,
        disableStdin,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(containerRef.current!);
      fitAddon.fit();

      termRef.current = term;
      fitAddonRef.current = fitAddon;
      await initWebgl(term);

      // Attach to session
      socket.emit("session-attach", sessionId, (res) => {
        if (res.ok) {
          attachedRef.current = true;
        } else {
          term.write(`\r\n\x1b[31mFailed to attach: ${res.error}\x1b[0m\r\n`);
        }
      });

      // Socket → Terminal
      socket.on("terminal-data", onTerminalData);
      socket.on("terminal-data-compressed", onCompressedData);

      // Terminal → Socket
      termDataDisposable = term.onData((data: string) => {
        sendInput(data);
      });

      onInputReady?.(sendInput);

      // Session exit
      socket.on("session-exit", onSessionExit);

      // Resize
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current!);

      detachTouchHandlers = bindTouchCursorMove() ?? null;
    }

    init();

    return () => {
      disposed = true;
      attachedRef.current = false;
      clearTimeout(readyFallback);
      resizeObserver?.disconnect();
      termDataDisposable?.dispose();
      detachTouchHandlers?.();
      detachTouchHandlers = null;
      detachWebglLossListener?.();
      detachWebglLossListener = null;
      webglAddonRef.current?.dispose();
      webglAddonRef.current = null;

      socket.off("terminal-data", onTerminalData);
      socket.off("terminal-data-compressed", onCompressedData);
      socket.off("session-exit", onSessionExit);
      socket.off("session-ready", onSessionReady);
      socket.emit("session-detach");
      onInputReady?.(null);

      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, activeSocket, activeConnected, handleResize, onInputReady, disableStdin]);

  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.fontSize = fontSize;
    handleResize();
  }, [fontSize, handleResize]);

  return (
    <div className="relative h-full w-full" style={{ backgroundColor: "#0b1220" }}>
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ backgroundColor: "#0b1220" }}
        >
          <div className="flex w-full max-w-sm flex-col gap-4 px-6">
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.3)]">
              <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    webglState === "active" ? "bg-emerald-400" : "bg-sky-400"
                  }`}
                />
                <span>{webglState === "active" ? "WebGL active" : "Preparing session"}</span>
              </div>
              <div className="space-y-3">
                {SKELETON_BARS.map((width, index) => (
                  <div
                    key={width}
                    className="h-3 overflow-hidden rounded-full bg-slate-900"
                  >
                    <div
                      className="h-full animate-pulse rounded-full bg-gradient-to-r from-sky-500/20 via-sky-400/70 to-cyan-300/20"
                      style={{
                        width: `${width}%`,
                        animationDelay: `${index * 120}ms`,
                        animationDuration: "1.2s",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <span className="text-center text-xs text-slate-500">
              Restoring terminal renderer and session stream…
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
