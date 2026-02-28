"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import pako from "pako";
import { useSocket } from "@/lib/useSocket";
import { usePendingApprovals } from "@/lib/hooks/usePendingApprovals";
import type {
  ApiResponse,
  ReplaceSessionChatMessagesRequest,
  SessionChatMessageInfo,
} from "@/lib/types";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface SessionChatbotViewProps {
  sessionId: string;
}

const ansiRegex = new RegExp("\\u001b\\[[0-9;]*[A-Za-z]", "g");

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
  return input.replaceAll("\r", "").replace(ansiRegex, "").trimEnd();
}

function decodeCompressedPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
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

export default function SessionChatbotView({
  sessionId,
}: SessionChatbotViewProps) {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { pendingApprovals, approve, deny } = usePendingApprovals();

  const activeApproval = useMemo(() => {
    const found = pendingApprovals.find((item) => item.sessionId === sessionId);
    return found ?? null;
  }, [pendingApprovals, sessionId]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    pendingAssistantIdRef.current = null;

    fetch(`/api/sessions/${sessionId}/chat-messages`)
      .then((res) => res.json())
      .then((json: ApiResponse<SessionChatMessageInfo[]>) => {
        if (!("data" in json)) return;
        setMessages(
          json.data.map((msg) => ({
            id: msg.id,
            role: msg.role,
            text: msg.text,
          })),
        );
      })
      .finally(() => setLoaded(true));
  }, [sessionId]);

  useEffect(() => {
    if (!loaded) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      const body: ReplaceSessionChatMessagesRequest = {
        messages: messages.map((msg) => ({ role: msg.role, text: msg.text })),
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
          return [...prev, { id, role: "assistant", text }];
        }
        return prev.map((msg) =>
          msg.id === currentId ? { ...msg, text: `${msg.text}${text}` } : msg,
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
        setError("Failed to decode assistant stream payload");
      }
    };

    const onSessionExit = (sid: string) => {
      if (sid !== sessionId) return;
      pendingAssistantIdRef.current = null;
      setStreaming(false);
      setAttached(false);
    };

    socket.emit("session-attach", sessionId, (res) => {
      if (!res.ok) {
        setError(res.error ?? "Failed to attach session");
        return;
      }
      setAttached(true);
      setError(null);
    });

    socket.on("terminal-data", onTerminalData);
    socket.on("terminal-data-compressed", onCompressedData);
    socket.on("session-exit", onSessionExit);

    return () => {
      socket.off("terminal-data", onTerminalData);
      socket.off("terminal-data-compressed", onCompressedData);
      socket.off("session-exit", onSessionExit);
      socket.emit("session-detach");
    };
  }, [socket, connected, sessionId]);

  async function sendPrompt() {
    const prompt = input.trim();
    if (!prompt) return;

    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: "user", text: prompt },
    ]);
    setInput("");
    setStreaming(true);
    pendingAssistantIdRef.current = null;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: prompt, appendNewline: true }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to send prompt");
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send prompt");
      setStreaming(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendPrompt();
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    e.preventDefault();
    void sendPrompt();
  }

  const statusText = useMemo(() => {
    if (!connected) return "Socket offline";
    if (!attached) return "Connecting session...";
    return streaming ? "Assistant responding..." : "Ready";
  }, [connected, attached, streaming]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-xs font-medium text-slate-600">{statusText}</span>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      {activeApproval && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2">
          <p className="text-[11px] font-medium text-amber-800">
            Command approval required
          </p>
          <p className="mt-1 font-mono text-xs text-amber-900">
            {activeApproval.command}
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            {activeApproval.matchedRule.description}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => deny(activeApproval.id)}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
            >
              Deny
            </button>
            <button
              type="button"
              onClick={() => approve(activeApproval.id)}
              className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white"
            >
              Approve
            </button>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Ask in natural language. Orbit will send it to the session and
            stream the response here.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[92%] rounded-2xl px-4 py-2 text-sm leading-6 ${
              msg.role === "user"
                ? "ml-auto bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-800"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-white px-4 py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            rows={2}
            placeholder="Type your request..."
            className="max-h-40 min-h-[44px] flex-1 resize-y rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
