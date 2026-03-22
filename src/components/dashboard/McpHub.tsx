"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiResponse, ApiError } from "@/lib/types";

interface McpServerInfo {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args: string | null;
  url: string | null;
  enabled: boolean;
  createdAt: string;
}

export default function McpHub() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTransport, setNewTransport] = useState<"stdio" | "sse">("stdio");
  const [newCommand, setNewCommand] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp/servers");
      const json = (await res.json()) as ApiResponse<McpServerInfo[]> | ApiError;
      if ("data" in json) setServers(json.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd() {
    if (!newName.trim()) return;
    await fetch("/api/mcp/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        transport: newTransport,
        ...(newTransport === "stdio" ? { command: newCommand.trim() } : { url: newUrl.trim() }),
      }),
    });
    setNewName(""); setNewCommand(""); setNewUrl("");
    setShowAdd(false);
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/mcp/servers?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-neutral-100 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">MCP Hub</h2>
          <p className="mt-1 text-xs text-neutral-400">Registered MCP servers and tools</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-700"
        >
          {showAdd ? "Cancel" : "+ Add Server"}
        </button>
      </div>

      {showAdd && (
        <div className="mt-3 space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Server name"
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:border-cyan-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNewTransport("stdio")}
              className={`rounded px-3 py-1 text-xs ${newTransport === "stdio" ? "bg-neutral-700 text-white" : "text-neutral-400"}`}
            >
              stdio
            </button>
            <button
              onClick={() => setNewTransport("sse")}
              className={`rounded px-3 py-1 text-xs ${newTransport === "sse" ? "bg-neutral-700 text-white" : "text-neutral-400"}`}
            >
              SSE
            </button>
          </div>
          {newTransport === "stdio" ? (
            <input
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:border-cyan-500 focus:outline-none"
            />
          ) : (
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="SSE endpoint URL"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:border-cyan-500 focus:outline-none"
            />
          )}
          <button
            onClick={() => void handleAdd()}
            disabled={!newName.trim()}
            className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          >
            Register
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-4 text-sm text-neutral-500">Loading...</div>
      ) : servers.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950/50 px-4 py-6 text-center text-sm text-neutral-400">
          No MCP servers registered
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {servers.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/70 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${s.enabled ? "bg-green-400" : "bg-neutral-600"}`} />
                  <span className="truncate text-xs font-medium text-neutral-200">{s.name}</span>
                  <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400">
                    {s.transport}
                  </span>
                </div>
                <div className="mt-1 truncate text-[11px] text-neutral-500">
                  {s.transport === "stdio" ? s.command : s.url}
                </div>
              </div>
              <button
                onClick={() => void handleDelete(s.id)}
                className="ml-2 rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
