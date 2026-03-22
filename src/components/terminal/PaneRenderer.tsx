"use client";

import type { PaneNode } from "@/lib/paneTree";
import type { OrbitSocket } from "@/lib/socketClient";
import type { SessionInfo, WorkspaceLayoutInfo } from "@/lib/types";
import { Fragment } from "react";
import SplitDivider from "./SplitDivider";
import TerminalPane from "./TerminalPane";

interface WorkspaceControls {
  workspaces: WorkspaceLayoutInfo[];
  selectedWorkspaceId: string;
  workspaceName: string;
  savingWorkspace: boolean;
  onSaveWorkspace: () => void;
  onApplyWorkspace: (workspace: WorkspaceLayoutInfo) => void;
  onDeleteWorkspace: () => void;
  onSelectWorkspace: (id: string) => void;
}

interface PaneRendererProps {
  node: PaneNode;
  activePaneId: string;
  sockets: Map<string, OrbitSocket>;
  socketStates: Map<string, boolean>;
  sessions: SessionInfo[];
  leafCount: number;
  attentionPanes: Set<string>;
  onActivate: (paneId: string) => void;
  onSplit: (paneId: string, direction: "horizontal" | "vertical") => void;
  onClose: (paneId: string) => void;
  onSelectSession: (paneId: string, sessionId: string) => void;
  onDropSession: (
    paneId: string,
    sessionId: string,
    position: "top" | "bottom" | "left" | "right" | "center",
  ) => void;
  onSwapPanes: (sourcePaneId: string, targetPaneId: string) => void;
  onMovePane: (
    sourcePaneId: string,
    targetPaneId: string,
    position: "top" | "bottom" | "left" | "right",
  ) => void;
  onRatioChange: (splitId: string, index: number, delta: number) => void;
  onPaneExit: (paneId: string) => void;
  onKillSession: (paneId: string, sessionId: string) => Promise<void> | void;
  workspace?: WorkspaceControls;
}

export default function PaneRenderer({
  node,
  activePaneId,
  sockets,
  socketStates,
  sessions,
  leafCount,
  attentionPanes,
  onActivate,
  onSplit,
  onClose,
  onSelectSession,
  onDropSession,
  onSwapPanes,
  onMovePane,
  onRatioChange,
  onPaneExit,
  onKillSession,
  workspace,
}: PaneRendererProps) {
  if (node.type === "leaf") {
    const leafSessionId = node.sessionId;
    return (
      <TerminalPane
        paneId={node.id}
        sessionId={node.sessionId}
        socket={sockets.get(node.id)}
        connected={socketStates.get(node.id) ?? false}
        isActive={node.id === activePaneId}
        needsAttention={attentionPanes.has(node.id)}
        sessions={sessions}
        onActivate={() => onActivate(node.id)}
        onSplit={(dir) => onSplit(node.id, dir)}
        onClose={() => onClose(node.id)}
        onSelectSession={(sid) => onSelectSession(node.id, sid)}
        onDropSession={(sid, position) => onDropSession(node.id, sid, position)}
        onSwapPane={(sourcePaneId) => onSwapPanes(sourcePaneId, node.id)}
        onMovePane={(sourcePaneId, position) =>
          onMovePane(sourcePaneId, node.id, position)
        }
        onExit={() => onPaneExit(node.id)}
        canClose={true}
        onKillSession={
          leafSessionId
            ? () => onKillSession(node.id, leafSessionId)
            : undefined
        }
        workspace={workspace}
      />
    );
  }

  // Split node
  const isHorizontal = node.direction === "horizontal";

  const sharedProps = {
    activePaneId,
    sockets,
    socketStates,
    sessions,
    leafCount,
    attentionPanes,
    onActivate,
    onSplit,
    onClose,
    onSelectSession,
    onDropSession,
    onSwapPanes,
    onMovePane,
    onRatioChange,
    onPaneExit,
    onKillSession,
    workspace,
  };

  return (
    <div
      className={`flex h-full w-full overflow-hidden ${isHorizontal ? "flex-row" : "flex-col"}`}
    >
      {node.children.map((child, index) => (
        <Fragment key={child.id}>
          <div
            style={{ flex: `0 1 ${node.ratios[index] * 100}%` }}
            className="min-h-0 min-w-0 overflow-hidden"
          >
            <PaneRenderer node={child} {...sharedProps} />
          </div>
          {index < node.children.length - 1 ? (
            <SplitDivider
              direction={node.direction}
              onDeltaChange={(delta) => onRatioChange(node.id, index, delta)}
              onReset={() => {
                const combined = node.ratios[index] + node.ratios[index + 1];
                onRatioChange(
                  node.id,
                  index,
                  combined / 2 - node.ratios[index],
                );
              }}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
