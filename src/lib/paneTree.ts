// --- Pane Tree data structure & pure functions ---

export interface PaneLeaf {
  type: "leaf";
  id: string;
  sessionId: string | null;
}

export interface PaneSplit {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  ratio: number; // 0.0~1.0, first child's proportion
  children: [PaneNode, PaneNode];
}

export type PaneNode = PaneLeaf | PaneSplit;

let counter = 0;
function nextId(): string {
  return `pane-${++counter}`;
}

export function createLeaf(sessionId: string | null = null): PaneLeaf {
  return { type: "leaf", id: nextId(), sessionId };
}

/** Split a leaf into two panes. The original leaf keeps its session; the new leaf gets newSessionId. */
export function splitPane(
  root: PaneNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  newSessionId: string | null = null,
): PaneNode {
  if (root.type === "leaf") {
    if (root.id === paneId) {
      return {
        type: "split",
        id: nextId(),
        direction,
        ratio: 0.5,
        children: [{ ...root }, createLeaf(newSessionId)],
      };
    }
    return root;
  }

  // split node — recurse into children
  const newChildren = root.children.map((child) =>
    splitPane(child, paneId, direction, newSessionId),
  ) as [PaneNode, PaneNode];

  if (
    newChildren[0] === root.children[0] &&
    newChildren[1] === root.children[1]
  ) {
    return root; // no change
  }
  return { ...root, children: newChildren };
}

/** Close a pane. Returns the surviving subtree, or null if the entire tree is removed. */
export function closePane(root: PaneNode, paneId: string): PaneNode | null {
  if (root.type === "leaf") {
    return root.id === paneId ? null : root;
  }

  const [first, second] = root.children;

  // Check if either direct child is the target leaf
  if (first.type === "leaf" && first.id === paneId) return second;
  if (second.type === "leaf" && second.id === paneId) return first;

  // Recurse
  const newFirst = closePane(first, paneId);
  const newSecond = closePane(second, paneId);

  if (newFirst === null) return newSecond;
  if (newSecond === null) return newFirst;

  if (newFirst === first && newSecond === second) return root;
  return { ...root, children: [newFirst, newSecond] };
}

export function findLeaf(root: PaneNode, paneId: string): PaneLeaf | null {
  if (root.type === "leaf") {
    return root.id === paneId ? root : null;
  }
  return (
    findLeaf(root.children[0], paneId) ?? findLeaf(root.children[1], paneId)
  );
}

export function updateLeafSession(
  root: PaneNode,
  paneId: string,
  sessionId: string | null,
): PaneNode {
  if (root.type === "leaf") {
    if (root.id === paneId) return { ...root, sessionId };
    return root;
  }

  const newChildren = root.children.map((child) =>
    updateLeafSession(child, paneId, sessionId),
  ) as [PaneNode, PaneNode];

  if (
    newChildren[0] === root.children[0] &&
    newChildren[1] === root.children[1]
  ) {
    return root;
  }
  return { ...root, children: newChildren };
}

export function updateSplitRatio(
  root: PaneNode,
  splitId: string,
  ratio: number,
): PaneNode {
  if (root.type === "leaf") return root;

  if (root.id === splitId) {
    return { ...root, ratio: Math.max(0.1, Math.min(0.9, ratio)) };
  }

  const newChildren = root.children.map((child) =>
    updateSplitRatio(child, splitId, ratio),
  ) as [PaneNode, PaneNode];

  if (
    newChildren[0] === root.children[0] &&
    newChildren[1] === root.children[1]
  ) {
    return root;
  }
  return { ...root, children: newChildren };
}

export function collectLeafIds(root: PaneNode): string[] {
  if (root.type === "leaf") return [root.id];
  return [
    ...collectLeafIds(root.children[0]),
    ...collectLeafIds(root.children[1]),
  ];
}
