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
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const attachedRef = useRef(false);
  const onExitRef = useRef(onExit);
  const fontSizeRef = useRef(fontSize);

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

    setReady(false);

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
        socket.emit("terminal-data", data);
      });

      onInputReady?.((data: string) => {
        socket.emit("terminal-data", data);
      });

      // Session exit
      socket.on("session-exit", onSessionExit);

      // Resize
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current!);
    }

    init();

    return () => {
      disposed = true;
      attachedRef.current = false;
      clearTimeout(readyFallback);
      resizeObserver?.disconnect();
      termDataDisposable?.dispose();

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
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
            <span className="text-xs text-slate-500">Preparing session…</span>
          </div>
        </div>
      )}
    </div>
  );
}
