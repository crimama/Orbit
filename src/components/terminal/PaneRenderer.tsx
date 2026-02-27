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
  onRatioChange: (splitId: string, ratio: number) => void;
  onPaneExit: (paneId: string) => void;
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
  onRatioChange,
  onPaneExit,
}: PaneRendererProps) {
  if (node.type === "leaf") {
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
        onExit={() => onPaneExit(node.id)}
        canClose={leafCount > 1}
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
    onRatioChange,
    onPaneExit,
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
