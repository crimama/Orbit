"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pako from "pako";
import type { OrbitSocket } from "@/lib/socketClient";
import type {
  ApiResponse,
  PendingApproval,
  ReplaceSessionChatMessagesRequest,
  SessionChatMessageInfo,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface ApprovalCard {
  id: string;
  command: string;
  description: string;
  resolved: boolean;
}

interface MobileChatTerminalProps {
  sessionId: string;
  socket: OrbitSocket;
  connected: boolean;
  yoloMode: boolean;
  onExit: () => void;
  onInputReady?: (sendInput: ((data: string) => void) | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers (from SessionChatbotView patterns)
// ---------------------------------------------------------------------------

const ANSI_RE = /\u001b\[[0-9;]*[A-Za-z]/g;
const COLLAPSE_LINES = 20;

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sanitizeText(input: string): string {
  return input.replaceAll("\r", "").replace(ANSI_RE, "").trimEnd();
}

function decodeCompressedPayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload instanceof Uint8Array) {
    return pako.inflate(payload, { to: "string" });
  }
  if (payload instanceof ArrayBuffer) {
    return pako.inflate(new Uint8Array(payload), { to: "string" });
  }
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return pako.inflate(
      new Uint8Array((payload as { data: number[] }).data),
      { to: "string" },
    );
  }
  return "";
}

// ---------------------------------------------------------------------------
// Collapsible message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  msg,
}: {
  msg: ChatMessage;
}) {
  const lines = msg.text.split("\n");
  const isLong = lines.length > COLLAPSE_LINES;
  const [expanded, setExpanded] = useState(false);

  const displayText =
    isLong && !expanded ? lines.slice(0, COLLAPSE_LINES).join("\n") : msg.text;

  const isUser = msg.role === "user";

  return (
    <div
      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.6] ${
        isUser
          ? "ml-auto bg-sky-600 text-white"
          : "bg-neutral-900 text-neutral-200"
      }`}
    >
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px]">
        {displayText}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-sky-400"
        >
          {expanded ? "Show less" : `Show more (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MobileChatTerminal({
  sessionId,
  socket,
  connected,
  yoloMode,
  onExit,
  onInputReady,
}: MobileChatTerminalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [attached, setAttached] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalCard[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yoloModeRef = useRef(yoloMode);
  yoloModeRef.current = yoloMode;

  // -----------------------------------------------------------------------
  // Status text
  // -----------------------------------------------------------------------
  const statusText = useMemo(() => {
    if (!connected) return "Offline";
    if (!attached) return "Connecting...";
    return streaming ? "Responding..." : "Ready";
  }, [connected, attached, streaming]);

  // -----------------------------------------------------------------------
  // Auto-scroll
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, approvals]);

  // -----------------------------------------------------------------------
  // Load persisted messages
  // -----------------------------------------------------------------------
  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    setApprovals([]);
    pendingAssistantIdRef.current = null;

    fetch(`/api/sessions/${sessionId}/chat-messages`)
      .then((res) => res.json())
      .then((json: ApiResponse<SessionChatMessageInfo[]>) => {
        if (!("data" in json)) return;
        setMessages(
          json.data.map((m) => ({ id: m.id, role: m.role, text: m.text })),
        );
      })
      .finally(() => setLoaded(true));
  }, [sessionId]);

  // -----------------------------------------------------------------------
  // Persist messages (debounced)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!loaded) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    persistTimerRef.current = setTimeout(() => {
      const body: ReplaceSessionChatMessagesRequest = {
        messages: messages.map((m) => ({ role: m.role, text: m.text })),
      };
      void fetch(`/api/sessions/${sessionId}/chat-messages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }, 300);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [loaded, messages, sessionId]);

  // -----------------------------------------------------------------------
  // Socket attachment + terminal data streaming
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !connected) return;

    function pushAssistantChunk(chunk: string) {
      const text = sanitizeText(chunk);
      if (!text) return;
      setMessages((prev) => {
        const currentId = pendingAssistantIdRef.current;
        if (!currentId) {
          const id = makeId();
          pendingAssistantIdRef.current = id;
          return [...prev, { id, role: "assistant" as const, text }];
        }
        return prev.map((m) =>
          m.id === currentId ? { ...m, text: `${m.text}${text}` } : m,
        );
      });
      setStreaming(true);
    }

    const onTerminalData = (data: string) => {
      pushAssistantChunk(typeof data === "string" ? data : String(data ?? ""));
    };

    const onCompressedData = (data: unknown) => {
      try {
        pushAssistantChunk(decodeCompressedPayload(data));
      } catch {
        // silently ignore decode errors
      }
    };

    const onSessionExit = (sid: string) => {
      if (sid !== sessionId) return;
      pendingAssistantIdRef.current = null;
      setStreaming(false);
      setAttached(false);
      onExit();
    };

    const onPending = (approval: PendingApproval) => {
      if (approval.sessionId !== sessionId) return;

      // YOLO mode: auto-approve immediately (read from ref to avoid dep)
      if (yoloModeRef.current) {
        socket.emit("interceptor-approve", approval.id);
        return;
      }

      setApprovals((prev) => [
        ...prev,
        {
          id: approval.id,
          command: approval.command,
          description: approval.matchedRule.description,
          resolved: false,
        },
      ]);
    };

    const onResolved = (approvalId: string) => {
      setApprovals((prev) =>
        prev.map((a) => (a.id === approvalId ? { ...a, resolved: true } : a)),
      );
    };

    socket.emit("session-attach", sessionId, (res) => {
      if (!res.ok) return;
      setAttached(true);
    });

    socket.on("terminal-data", onTerminalData);
    socket.on("terminal-data-compressed", onCompressedData);
    socket.on("session-exit", onSessionExit);
    socket.on("interceptor-pending", onPending);
    socket.on("interceptor-resolved", onResolved);

    // Expose a sendInput function via onInputReady for compatibility
    const sendInput = (data: string) => {
      socket.emit("terminal-data", data);
    };
    onInputReady?.(sendInput);

    return () => {
      socket.off("terminal-data", onTerminalData);
      socket.off("terminal-data-compressed", onCompressedData);
      socket.off("session-exit", onSessionExit);
      socket.off("interceptor-pending", onPending);
      socket.off("interceptor-resolved", onResolved);
      socket.emit("session-detach");
      setAttached(false);
      onInputReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, sessionId]);

  // -----------------------------------------------------------------------
  // YOLO mode toggled on: auto-approve all pending
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!yoloMode || !socket) return;
    for (const card of approvals) {
      if (!card.resolved) {
        socket.emit("interceptor-approve", card.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yoloMode]);

  // -----------------------------------------------------------------------
  // Send user input
  // -----------------------------------------------------------------------
  const handleSubmit = useCallback(() => {
    const value = inputValueRef.current.trim();
    if (!value || !socket || !attached) return;

    // Finalize current assistant message
    pendingAssistantIdRef.current = null;

    // Add user bubble
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: "user", text: value },
    ]);

    // Send to PTY via socket (not REST) — socket handlers share the same
    // ptyManager instance, whereas Next.js API routes get a separate module
    // instance that doesn't have the running PTY processes.
    socket.emit("terminal-data", value + "\r");

    setInput("");
    inputValueRef.current = "";
    setStreaming(true);
  }, [socket, attached]);

  // -----------------------------------------------------------------------
  // Approval actions
  // -----------------------------------------------------------------------
  const handleApprove = useCallback(
    (id: string) => {
      if (!socket) return;
      socket.emit("interceptor-approve", id);
      setApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
      );
    },
    [socket],
  );

  const handleDeny = useCallback(
    (id: string) => {
      if (!socket) return;
      socket.emit("interceptor-deny", id);
      setApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
      );
    },
    [socket],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex h-full flex-col bg-neutral-950">
      {/* Status bar */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connected && attached ? "bg-emerald-500" : "bg-neutral-600"
          }`}
        />
        <span className="text-[11px] font-medium text-neutral-500">
          {statusText}
        </span>
      </div>

      {/* Message viewport */}
      <div
        ref={viewportRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 && loaded && (
          <div className="rounded-xl bg-neutral-900 px-3 py-2.5 text-[12px] text-neutral-500">
            Type a command below. Output appears here as chat bubbles.
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Inline approval cards */}
        {approvals
          .filter((a) => !a.resolved)
          .map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-amber-700/50 bg-amber-950/60 px-3.5 py-2.5"
            >
              <p className="text-[11px] font-medium text-amber-400">
                Permission required
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[12px] text-amber-200">
                {card.command}
              </pre>
              <p className="mt-1 text-[11px] text-amber-500">
                {card.description}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDeny(card.id)}
                  className="rounded-lg bg-neutral-800 px-3.5 py-1.5 text-[12px] font-medium text-neutral-300 active:bg-neutral-700"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(card.id)}
                  className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-[12px] font-medium text-white active:bg-amber-500"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-1.5 border-t border-neutral-800 bg-neutral-900 px-2 py-1.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            setInput(v);
            inputValueRef.current = v;
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(e) => {
            setIsComposing(false);
            const v = (e.target as HTMLInputElement).value;
            setInput(v);
            inputValueRef.current = v;
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !isComposing &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={attached ? "Type command..." : "Connecting..."}
          className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-base text-neutral-100 placeholder-neutral-500 outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || !attached}
          className="min-h-[40px] rounded-lg bg-sky-600 px-3.5 text-sm font-semibold text-white transition active:bg-sky-500 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
