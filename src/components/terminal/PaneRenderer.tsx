"use client";

import type { PaneNode } from "@/lib/paneTree";
import type { OrbitSocket } from "@/lib/socketClient";
import type { SessionInfo } from "@/lib/types";
import SplitDivider from "./SplitDivider";
import TerminalPane from "./TerminalPane";

interface PaneRendererProps {
  node: PaneNode;
  activePaneId: string;
  sockets: Map<string, OrbitSocket>;
  socketStates: Map<string, boolean>;
  sessions: SessionInfo[];
  leafCount: number;
  exitedPanes: Set<string>;
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
  onRatioChange: (splitId: string, ratio: number) => void;
  onPaneExit: (paneId: string) => void;
  onKillSession: (paneId: string, sessionId: string) => Promise<void> | void;
}

export default function PaneRenderer({
  node,
  activePaneId,
  sockets,
  socketStates,
  sessions,
  leafCount,
  exitedPanes,
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
        exited={exitedPanes.has(node.id)}
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
      />
    );
  }

  // Split node
  const isHorizontal = node.direction === "horizontal";
  const firstPercent = `${node.ratio * 100}%`;
  const secondPercent = `${(1 - node.ratio) * 100}%`;

  const sharedProps = {
    activePaneId,
    sockets,
    socketStates,
    sessions,
    leafCount,
    exitedPanes,
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
  };

  return (
    <div
      className={`flex h-full w-full ${isHorizontal ? "flex-row" : "flex-col"}`}
    >
      <div
        style={{ flexBasis: firstPercent }}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <PaneRenderer node={node.children[0]} {...sharedProps} />
      </div>
      <SplitDivider
        direction={node.direction}
        onRatioChange={(ratio) => onRatioChange(node.id, ratio)}
      />
      <div
        style={{ flexBasis: secondPercent }}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <PaneRenderer node={node.children[1]} {...sharedProps} />
      </div>
    </div>
  );
}
