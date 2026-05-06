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
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
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
    return pako.inflate(new Uint8Array((payload as { data: number[] }).data), {
      to: "string",
    });
  }
  return "";
}

// ---------------------------------------------------------------------------
// Collapsible message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
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

function LoadingSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`h-11 animate-pulse rounded-2xl bg-neutral-800 ${
            index === 1 ? "w-[70%]" : index === 2 ? "w-[56%]" : "w-[82%]"
          }`}
        />
      ))}
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
  const [attachError, setAttachError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputValueRef = useRef("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachAttemptRef = useRef(0);
  const yoloModeRef = useRef(yoloMode);
  yoloModeRef.current = yoloMode;

  // -----------------------------------------------------------------------
  // Status text
  // -----------------------------------------------------------------------
  const statusText = useMemo(() => {
    if (!connected) return "Offline";
    if (attachError) return attachError;
    if (!attached) return "Connecting...";
    return streaming ? "Responding..." : "Ready";
  }, [attachError, connected, attached, streaming]);

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

    let cancelled = false;
    attachAttemptRef.current = 0;

    function clearAttachRetry() {
      if (!attachRetryRef.current) return;
      clearTimeout(attachRetryRef.current);
      attachRetryRef.current = null;
    }

    function scheduleAttachRetry(message: string) {
      setAttached(false);
      setAttachError(message);
      const nextAttempt = attachAttemptRef.current + 1;
      attachAttemptRef.current = nextAttempt;
      if (nextAttempt > 5) return;
      const delay = Math.min(500 * nextAttempt, 2_000);
      clearAttachRetry();
      attachRetryRef.current = setTimeout(() => {
        if (!cancelled) {
          tryAttach();
        }
      }, delay);
    }

    function tryAttach() {
      if (cancelled) return;
      socket.emit("session-attach", sessionId, (res) => {
        if (cancelled) return;
        if (!res.ok) {
          scheduleAttachRetry(res.error ?? "Attach failed");
          return;
        }
        clearAttachRetry();
        attachAttemptRef.current = 0;
        setAttachError(null);
        setAttached(true);
      });
    }

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
      setAttachError("Session ended");
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

    setAttachError(null);
    tryAttach();

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
      cancelled = true;
      clearAttachRetry();
      attachAttemptRef.current = 0;
      socket.off("terminal-data", onTerminalData);
      socket.off("terminal-data-compressed", onCompressedData);
      socket.off("session-exit", onSessionExit);
      socket.off("interceptor-pending", onPending);
      socket.off("interceptor-resolved", onResolved);
      socket.emit("session-detach");
      setAttached(false);
      setAttachError(null);
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
    if (!value) return;

    // Finalize current assistant message
    pendingAssistantIdRef.current = null;

    // Add user bubble
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: "user", text: value },
    ]);

    setAttachError(null);
    setStreaming(true);

    setInput("");
    inputValueRef.current = "";

    void fetch(`/api/sessions/${sessionId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: value, appendNewline: true }),
    })
      .then(async (res) => {
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to send command");
        }
      })
      .catch((err: unknown) => {
        setMessages((prev) =>
          prev.filter((msg) => msg.text !== value || msg.role !== "user")
            .length === prev.length
            ? prev
            : prev.slice(0, -1),
        );
        setInput(value);
        inputValueRef.current = value;
        setStreaming(false);
        setAttachError(
          err instanceof Error ? err.message : "Failed to send command",
        );
      });
  }, [sessionId]);

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
        {!loaded && <LoadingSkeleton />}

        {messages.length === 0 && loaded && (
          <div className="rounded-xl bg-neutral-900 px-3 py-2.5 text-[12px] text-neutral-500">
            Send a message below. Orbit replies here in a chat-style timeline.
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
        <textarea
          ref={inputRef}
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
            const v = (e.target as HTMLTextAreaElement).value;
            setInput(v);
            inputValueRef.current = v;
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (isComposing || e.nativeEvent.isComposing) return;
            e.preventDefault();
            e.stopPropagation();

            if (e.metaKey || e.ctrlKey) {
              handleSubmit();
              return;
            }

            const target = e.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const next = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
            setInput(next);
            inputValueRef.current = next;
            window.requestAnimationFrame(() => {
              target.setSelectionRange(start + 1, start + 1);
            });
          }}
          placeholder={attached ? "Ask Orbit…" : "Ask Orbit while it connects…"}
          rows={2}
          className="max-h-28 min-h-[40px] min-w-0 flex-1 resize-y rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-base leading-5 text-neutral-100 placeholder-neutral-500 outline-none focus:border-border-focus"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="min-h-[40px] rounded-lg bg-sky-600 px-3.5 text-sm font-semibold text-white transition active:bg-sky-500 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
