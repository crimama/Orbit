"use client";

import { useEffect, useRef, useCallback } from "react";
import type { OrbitSocket } from "@/lib/socketClient";
import { useSocket } from "@/lib/useSocket";

interface TerminalViewProps {
  sessionId: string;
  socket?: OrbitSocket;
  connected?: boolean;
  onExit?: (exitCode: number) => void;
}

export default function TerminalView({
  sessionId,
  socket,
  connected,
  onExit,
}: TerminalViewProps) {
  const { socket: fallbackSocket, connected: fallbackConnected } = useSocket();
  const activeSocket = socket ?? fallbackSocket;
  const activeConnected = connected ?? fallbackConnected;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const attachedRef = useRef(false);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

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

    const onTerminalData = (data: string) => {
      termRef.current?.write(data);
    };

    const onSessionExit = (sid: string, exitCode: number) => {
      // Ignore exit events for other sessions on shared socket.
      if (sid !== sessionId) return;
      termRef.current?.write(`\r\n\x1b[33m[Session exited: ${exitCode}]\x1b[0m\r\n`);
      attachedRef.current = false;
      onExitRef.current?.(exitCode);
    };

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 16,
        lineHeight: 1.45,
        fontFamily: "var(--font-geist-mono), monospace",
        theme: {
          background: "#020617",
          foreground: "#e2e8f0",
          cursor: "#7dd3fc",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      // Try WebGL addon for hardware acceleration
      try {
        const { WebglAddon } = await import("@xterm/addon-webgl");
        if (!disposed) {
          term.loadAddon(new WebglAddon());
        }
      } catch {
        // WebGL not available — fallback to canvas renderer
      }

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

      // Terminal → Socket
      termDataDisposable = term.onData((data: string) => {
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
      resizeObserver?.disconnect();
      termDataDisposable?.dispose();

      socket.off("terminal-data", onTerminalData);
      socket.off("session-exit", onSessionExit);
      socket.emit("session-detach");

      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, activeSocket, activeConnected, handleResize]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ backgroundColor: "#020617" }}
    />
  );
}
