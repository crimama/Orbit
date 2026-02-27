"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SkillNode from "./SkillNode";
import GraphToolbar from "./GraphToolbar";
import ConnectionPanel from "./ConnectionPanel";
import LiveTrace from "./LiveTrace";

import type {
  GraphState,
  SkillNodeInfo,
  SkillEdgeInfo,
  SkillNodeStatus,
  ApiResponse,
} from "@/lib/types";
import { GRAPH_AUTOSAVE_DEBOUNCE_MS, SKILL_NODE_WIDTH, SKILL_NODE_HEIGHT } from "@/lib/constants";

const nodeTypes = { skill: SkillNode };

function toReactFlowNode(skill: SkillNodeInfo): Node {
  return {
    id: skill.id,
    type: "skill",
    position: { x: skill.posX, y: skill.posY },
    data: { ...skill },
    width: SKILL_NODE_WIDTH,
    height: SKILL_NODE_HEIGHT,
  };
}

function toReactFlowEdge(edge: SkillEdgeInfo): Edge {
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.label ?? undefined,
    animated: edge.animated,
    style: { stroke: "#4b5563" },
    labelStyle: { fill: "#9ca3af", fontSize: 10 },
  };
}

interface SkillGraphInnerProps {
  projectId: string;
}

function SkillGraphInner({ projectId }: SkillGraphInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [skillNodes, setSkillNodes] = useState<SkillNodeInfo[]>([]);
  const [skillEdges, setSkillEdges] = useState<SkillEdgeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);

  const positionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch graph state
  useEffect(() => {
    let cancelled = false;

    async function fetchGraph() {
      setLoading(true);
      try {
        const res = await fetch(`/api/skills?projectId=${projectId}`);
        const json = (await res.json()) as ApiResponse<GraphState>;
        if (cancelled || !("data" in json)) return;

        const state = json.data;
        setReadOnly(Boolean(state.readOnly));
        setSkillNodes(state.nodes);
        setSkillEdges(state.edges);
        setNodes(state.nodes.map(toReactFlowNode));
        setEdges(state.edges.map(toReactFlowEdge));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGraph();
    return () => {
      cancelled = true;
    };
  }, [projectId, setNodes, setEdges]);

  // Handle new connections
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (readOnly) return;
      if (!connection.source || !connection.target) return;

      // Optimistic add
      setEdges((eds) => addEdge({ ...connection, animated: false, style: { stroke: "#4b5563" } }, eds));

      // Persist via API
      try {
        const res = await fetch(`/api/skills/${connection.source}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edge: {
              sourceId: connection.source,
              targetId: connection.target,
            },
          }),
        });
        const json = (await res.json()) as ApiResponse<SkillEdgeInfo>;
        if ("data" in json) {
          const newEdge = json.data;
          setSkillEdges((prev) => [...prev, newEdge]);
          // Replace the optimistic edge with the real one
          setEdges((eds) =>
            eds.map((e) =>
              e.source === connection.source && e.target === connection.target
                ? toReactFlowEdge(newEdge)
                : e,
            ),
          );
        }
      } catch {
        // Revert on failure
        setEdges((eds) =>
          eds.filter(
            (e) =>
              !(e.source === connection.source && e.target === connection.target),
          ),
        );
      }
    },
    [setEdges, readOnly],
  );

  const savePositions = useCallback(() => {
    // Read current nodes from the DOM state
    setNodes((currentNodes) => {
      const positions = currentNodes.map((n) => ({
        id: n.id,
        posX: n.position.x,
        posY: n.position.y,
      }));

      if (positions.length > 0) {
        fetch("/api/skills", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positions }),
        }).catch(() => {
          // Silently ignore save failures
        });
      }

      return currentNodes; // Return unchanged
    });
  }, [setNodes]);

  // Debounced position save
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      if (readOnly) return;

      // Check if any position changes
      const hasPositionChange = changes.some(
        (c) => c.type === "position" && "position" in c && c.position,
      );

      if (hasPositionChange) {
        if (positionSaveTimer.current) {
          clearTimeout(positionSaveTimer.current);
        }
        positionSaveTimer.current = setTimeout(() => {
          savePositions();
        }, GRAPH_AUTOSAVE_DEBOUNCE_MS);
      }
    },
    [onNodesChange, savePositions, readOnly],
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      if (readOnly) return;
      for (const node of deletedNodes) {
        try {
          await fetch(`/api/skills/${node.id}`, { method: "DELETE" });
          setSkillNodes((prev) => prev.filter((n) => n.id !== node.id));
          setSkillEdges((prev) =>
            prev.filter(
              (e) => e.sourceId !== node.id && e.targetId !== node.id,
            ),
          );
        } catch {
          // Ignore delete failures
        }
      }
    },
    [readOnly],
  );

  // Handle skill creation from toolbar
  const handleSkillCreated = useCallback(
    (skill: SkillNodeInfo) => {
      setSkillNodes((prev) => [...prev, skill]);
      setNodes((prev) => [...prev, toReactFlowNode(skill)]);
    },
    [setNodes],
  );

  // Handle edge deletion from connection panel
  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      // Find the edge to get the sourceId for the API call
      const edge = skillEdges.find((e) => e.id === edgeId);
      if (!edge) return;

      // Optimistic removal
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSkillEdges((prev) => prev.filter((e) => e.id !== edgeId));

      try {
        await fetch(`/api/skills/${edge.sourceId}?edgeId=${edgeId}`, {
          method: "DELETE",
        });
      } catch {
        // Revert on failure
        setEdges((eds) => [...eds, toReactFlowEdge(edge)]);
        setSkillEdges((prev) => [...prev, edge]);
      }
    },
    [skillEdges, setEdges],
  );

  // Live trace: update node status
  const handleTraceUpdate = useCallback(
    (skillId: string, status: SkillNodeStatus) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === skillId
            ? { ...n, data: { ...n.data, status } }
            : n,
        ),
      );
    },
    [setNodes],
  );

  // Memoize default edge options
  const defaultEdgeOptions = useMemo(
    () => ({
      style: { stroke: "#4b5563", strokeWidth: 1.5 },
      type: "default" as const,
    }),
    [],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900">
        <div className="text-sm text-gray-500">Loading graph...</div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        deleteKeyCode={readOnly ? null : "Delete"}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!border-gray-700 !bg-gray-800/90 [&>button]:!border-gray-700 [&>button]:!bg-gray-800 [&>button]:!fill-gray-400 [&>button:hover]:!bg-gray-700"
        />
        <MiniMap
          nodeColor="#4b5563"
          maskColor="rgba(0,0,0,0.7)"
          className="!border-gray-700 !bg-gray-900"
        />
      </ReactFlow>

      {!readOnly && (
        <GraphToolbar
          projectId={projectId}
          onSkillCreated={handleSkillCreated}
          onSavePositions={savePositions}
        />
      )}

      <ConnectionPanel
        edges={skillEdges}
        nodes={skillNodes}
        onDeleteEdge={handleDeleteEdge}
        readOnly={readOnly}
      />

      {readOnly && (
        <div className="absolute left-3 top-3 z-10 rounded border border-amber-700/50 bg-amber-900/30 px-2 py-1 text-xs text-amber-300">
          skill_graph directory mode (read-only)
        </div>
      )}

      <LiveTrace onTraceUpdate={handleTraceUpdate} />
    </div>
  );
}

// Wrap in ReactFlowProvider so useReactFlow works in toolbar
export default function SkillGraph({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <SkillGraphInner projectId={projectId} />
    </ReactFlowProvider>
  );
}
