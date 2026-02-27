"use client";

import { useState, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import type { CreateSkillRequest, ApiResponse, SkillNodeInfo } from "@/lib/types";

interface GraphToolbarProps {
  projectId: string;
  onSkillCreated: (skill: SkillNodeInfo) => void;
  onSavePositions: () => void;
}

export default function GraphToolbar({
  projectId,
  onSkillCreated,
  onSavePositions,
}: GraphToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState("default");
  const [mcpEndpoint, setMcpEndpoint] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const body: CreateSkillRequest = {
        projectId,
        name: name.trim(),
        nodeType,
        mcpEndpoint: mcpEndpoint.trim() || undefined,
      };
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<SkillNodeInfo>;
      if ("data" in json) {
        onSkillCreated(json.data);
        setName("");
        setNodeType("default");
        setMcpEndpoint("");
        setShowForm(false);
      }
    } finally {
      setCreating(false);
    }
  }, [projectId, name, nodeType, mcpEndpoint, onSkillCreated]);

  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
      {/* Control buttons */}
      <div className="flex gap-1 rounded-lg border border-gray-700 bg-gray-800/90 p-1 backdrop-blur-sm">
        <ToolbarButton
          title="Add Node"
          onClick={() => setShowForm(!showForm)}
        >
          <PlusIcon />
        </ToolbarButton>
        <ToolbarButton title="Zoom In" onClick={() => zoomIn()}>
          <ZoomInIcon />
        </ToolbarButton>
        <ToolbarButton title="Zoom Out" onClick={() => zoomOut()}>
          <ZoomOutIcon />
        </ToolbarButton>
        <ToolbarButton title="Fit View" onClick={() => fitView({ padding: 0.2 })}>
          <FitIcon />
        </ToolbarButton>
        <ToolbarButton title="Save Positions" onClick={onSavePositions}>
          <SaveIcon />
        </ToolbarButton>
      </div>

      {/* Add Node Form */}
      {showForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/95 p-3 backdrop-blur-sm">
          <div className="mb-2 text-xs font-semibold text-gray-300">
            Add Skill Node
          </div>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-2 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 outline-none focus:border-gray-500"
          />
          <select
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value)}
            className="mb-2 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-100 outline-none focus:border-gray-500"
          >
            <option value="default">default</option>
            <option value="tool">tool</option>
            <option value="mcp">mcp</option>
            <option value="agent">agent</option>
          </select>
          <input
            type="text"
            placeholder="MCP Endpoint (optional)"
            value={mcpEndpoint}
            onChange={(e) => setMcpEndpoint(e.target.value)}
            className="mb-2 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 outline-none focus:border-gray-500"
          />
          <div className="flex gap-1">
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
    >
      {children}
    </button>
  );
}

// Small inline SVG icons

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="7" y1="2" x2="7" y2="12" />
      <line x1="2" y1="7" x2="12" y2="7" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="4" />
      <line x1="9" y1="9" x2="13" y2="13" />
      <line x1="4" y1="6" x2="8" y2="6" />
      <line x1="6" y1="4" x2="6" y2="8" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="4" />
      <line x1="9" y1="9" x2="13" y2="13" />
      <line x1="4" y1="6" x2="8" y2="6" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="1,5 1,1 5,1" />
      <polyline points="9,1 13,1 13,5" />
      <polyline points="13,9 13,13 9,13" />
      <polyline points="5,13 1,13 1,9" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 13H3a1 1 0 01-1-1V3a1 1 0 011-1h6l3 3v7a1 1 0 01-1 1z" />
      <polyline points="9,2 9,5 5,5" />
      <line x1="5" y1="8" x2="9" y2="8" />
      <line x1="5" y1="10" x2="7" y2="10" />
    </svg>
  );
}
