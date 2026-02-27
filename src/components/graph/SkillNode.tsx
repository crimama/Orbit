"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SkillNodeInfo, SkillNodeStatus } from "@/lib/types";
import { SKILL_NODE_WIDTH } from "@/lib/constants";

type SkillNodeData = SkillNodeInfo & { status?: SkillNodeStatus };

const STATUS_COLORS: Record<SkillNodeStatus, string> = {
  idle: "bg-gray-500",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error: "bg-red-500",
};

const STATUS_GLOW: Record<SkillNodeStatus, string> = {
  idle: "",
  running: "shadow-[0_0_12px_rgba(59,130,246,0.6)]",
  success: "shadow-[0_0_8px_rgba(34,197,94,0.4)]",
  error: "shadow-[0_0_8px_rgba(239,68,68,0.4)]",
};

const NODE_TYPE_BADGES: Record<string, string> = {
  default: "bg-gray-600 text-gray-300",
  tool: "bg-indigo-700 text-indigo-200",
  mcp: "bg-purple-700 text-purple-200",
  agent: "bg-amber-700 text-amber-200",
};

function SkillNodeComponent({ data }: NodeProps) {
  const skill = data as unknown as SkillNodeData;
  const status: SkillNodeStatus = skill.status ?? "idle";
  const badgeClass =
    NODE_TYPE_BADGES[skill.nodeType] ?? NODE_TYPE_BADGES.default;

  return (
    <div
      className={`rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 transition-shadow ${STATUS_GLOW[status]}`}
      style={{ width: SKILL_NODE_WIDTH }}
    >
      {/* Header row: status dot + nodeType badge */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[status]}`}
          />
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}
          >
            {skill.nodeType}
          </span>
        </div>
        <span className="text-[10px] text-gray-500">{status}</span>
      </div>

      {/* Skill name */}
      <div className="truncate text-sm font-medium text-gray-100">
        {skill.name}
      </div>

      {/* MCP endpoint */}
      {skill.mcpEndpoint && (
        <div className="mt-0.5 truncate text-xs text-gray-500">
          {skill.mcpEndpoint}
        </div>
      )}

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-gray-600 !bg-gray-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-gray-600 !bg-gray-400"
      />
    </div>
  );
}

export default memo(SkillNodeComponent);
