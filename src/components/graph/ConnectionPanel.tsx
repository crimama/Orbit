"use client";

import { useState } from "react";
import type { SkillEdgeInfo, SkillNodeInfo } from "@/lib/types";

interface ConnectionPanelProps {
  edges: SkillEdgeInfo[];
  nodes: SkillNodeInfo[];
  onDeleteEdge: (id: string) => void;
  readOnly?: boolean;
}

export default function ConnectionPanel({
  edges,
  nodes,
  onDeleteEdge,
  readOnly = false,
}: ConnectionPanelProps) {
  const [collapsed, setCollapsed] = useState(true);

  const nodeNameMap = new Map<string, string>();
  for (const node of nodes) {
    nodeNameMap.set(node.id, node.name);
  }

  return (
    <div
      className={`absolute right-0 top-0 z-10 flex h-full flex-col border-l border-gray-700 bg-gray-800/95 backdrop-blur-sm transition-all ${
        collapsed ? "w-10" : "w-64"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 w-full items-center justify-center border-b border-gray-700 text-gray-400 transition-colors hover:text-gray-200"
        title={collapsed ? "Show edges" : "Hide edges"}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
        >
          <polyline points="9,2 4,7 9,12" />
        </svg>
      </button>

      {!collapsed && (
        <>
          <div className="border-b border-gray-700 px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-300">
              Connections ({edges.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {edges.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">
                No connections yet. Drag between node handles to create one.
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {edges.map((edge) => (
                  <div
                    key={edge.id}
                    className="group flex items-center gap-2 rounded border border-gray-700 px-2 py-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="truncate font-medium text-gray-200">
                          {nodeNameMap.get(edge.sourceId) ?? "?"}
                        </span>
                        <span className="flex-shrink-0 text-gray-500">
                          &rarr;
                        </span>
                        <span className="truncate font-medium text-gray-200">
                          {nodeNameMap.get(edge.targetId) ?? "?"}
                        </span>
                      </div>
                      {edge.label && (
                        <div className="mt-0.5 truncate text-[10px] text-gray-500">
                          {edge.label}
                        </div>
                      )}
                    </div>
                    {edge.animated && (
                      <span className="flex-shrink-0 text-[10px] text-blue-400">
                        anim
                      </span>
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => onDeleteEdge(edge.id)}
                        className="flex-shrink-0 rounded p-0.5 text-gray-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        title="Delete connection"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <line x1="3" y1="3" x2="9" y2="9" />
                          <line x1="9" y1="3" x2="3" y2="9" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
