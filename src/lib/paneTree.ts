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
  ratios: number[];
  children: PaneNode[];
}

export type PaneNode = PaneLeaf | PaneSplit;

let counter = 0;

function nextId(): string {
  return `pane-${++counter}`;
}

function syncCounterFromId(id: string): void {
  const match = /^pane-(\d+)$/.exec(id);
  if (!match) return;

  const parsed = Number.parseInt(match[1], 10);
  if (Number.isFinite(parsed) && parsed > counter) {
    counter = parsed;
  }
}

function createEqualRatios(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

function normalizeRatios(ratios: number[], count: number): number[] {
  if (count <= 0) return [];
  if (ratios.length !== count) return createEqualRatios(count);

  const sanitized = ratios.map((ratio) =>
    Number.isFinite(ratio) && ratio > 0 ? ratio : 0,
  );
  const total = sanitized.reduce((sum, ratio) => sum + ratio, 0);

  if (total <= 0) return createEqualRatios(count);
  return sanitized.map((ratio) => ratio / total);
}

function hasSameChildren(current: PaneNode[], next: PaneNode[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((child, index) => child === next[index]);
}

function flattenSplit(node: PaneSplit): PaneNode {
  const flattenedChildren: PaneNode[] = [];
  const flattenedRatios: number[] = [];

  node.children.forEach((child, index) => {
    const parentRatio = node.ratios[index] ?? 0;
    if (child.type === "split" && child.direction === node.direction) {
      child.children.forEach((grandChild, grandIndex) => {
        flattenedChildren.push(grandChild);
        flattenedRatios.push(parentRatio * (child.ratios[grandIndex] ?? 0));
      });
      return;
    }

    flattenedChildren.push(child);
    flattenedRatios.push(parentRatio);
  });

  if (flattenedChildren.length === 0) {
    return createLeaf(null);
  }

  if (flattenedChildren.length === 1) {
    return flattenedChildren[0];
  }

  return {
    ...node,
    children: flattenedChildren,
    ratios: normalizeRatios(flattenedRatios, flattenedChildren.length),
  };
}

function splitPaneInternal(
  root: PaneNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  newSessionId: string | null,
): PaneNode {
  if (root.type === "leaf") {
    if (root.id !== paneId) return root;

    return {
      type: "split",
      id: nextId(),
      direction,
      ratios: [0.5, 0.5],
      children: [{ ...root }, createLeaf(newSessionId)],
    };
  }

  const children = root.children.map((child) =>
    splitPaneInternal(child, paneId, direction, newSessionId),
  );

  if (hasSameChildren(root.children, children)) {
    return root;
  }

  return {
    ...root,
    children,
  };
}

function distributeRemovedRatio(
  ratios: number[],
  removedRatio: number,
  remainingCount: number,
): number[] {
  if (remainingCount <= 0) return [];
  if (remainingCount === 1) return [1];

  const increment = removedRatio / remainingCount;
  return normalizeRatios(
    ratios.map((ratio) => ratio + increment),
    remainingCount,
  );
}

function adjustAdjacentRatios(
  ratios: number[],
  index: number,
  delta: number,
): number[] {
  if (index < 0 || index >= ratios.length - 1) return ratios;
  if (!Number.isFinite(delta) || delta === 0) return ratios;

  const next = [...ratios];
  const combined = next[index] + next[index + 1];
  const minRatio = Math.min(0.1, combined / 2);
  const nextLeft = Math.min(
    Math.max(next[index] + delta, minRatio),
    combined - minRatio,
  );
  const nextRight = combined - nextLeft;

  if (nextLeft === next[index] && nextRight === next[index + 1]) {
    return ratios;
  }

  next[index] = nextLeft;
  next[index + 1] = nextRight;
  return normalizeRatios(next, next.length);
}

export function createLeaf(sessionId: string | null = null): PaneLeaf {
  const id = nextId();
  return { type: "leaf", id, sessionId };
}

/** Split a leaf pane. Same-direction nested splits are flattened after insertion. */
export function splitPane(
  root: PaneNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  newSessionId: string | null = null,
): PaneNode {
  const next = splitPaneInternal(root, paneId, direction, newSessionId);
  return next === root ? root : flattenSameDirection(next);
}

export function flattenSameDirection(root: PaneNode): PaneNode {
  if (root.type === "leaf") return root;

  const children = root.children.map((child) => flattenSameDirection(child));
  const normalizedRoot: PaneSplit = {
    ...root,
    children,
    ratios: normalizeRatios(root.ratios, children.length),
  };

  return flattenSplit(normalizedRoot);
}

/** Close a pane. Returns the surviving subtree, or null if the entire tree is removed. */
export function closePane(root: PaneNode, paneId: string): PaneNode | null {
  if (root.type === "leaf") {
    return root.id === paneId ? null : root;
  }

  let removedRatio = 0;
  let changed = false;
  const remainingChildren: PaneNode[] = [];
  const remainingRatios: number[] = [];

  root.children.forEach((child, index) => {
    const nextChild = closePane(child, paneId);
    if (nextChild === null) {
      removedRatio += root.ratios[index] ?? 0;
      changed = true;
      return;
    }

    if (nextChild !== child) changed = true;
    remainingChildren.push(nextChild);
    remainingRatios.push(root.ratios[index] ?? 0);
  });

  if (!changed) return root;
  if (remainingChildren.length === 0) return null;
  if (remainingChildren.length === 1) return remainingChildren[0];

  return {
    ...root,
    children: remainingChildren,
    ratios: distributeRemovedRatio(
      remainingRatios,
      removedRatio,
      remainingChildren.length,
    ),
  };
}

export function findLeaf(root: PaneNode, paneId: string): PaneLeaf | null {
  if (root.type === "leaf") {
    return root.id === paneId ? root : null;
  }

  for (const child of root.children) {
    const found = findLeaf(child, paneId);
    if (found) return found;
  }

  return null;
}

export function updateLeafSession(
  root: PaneNode,
  paneId: string,
  sessionId: string | null,
): PaneNode {
  if (root.type === "leaf") {
    return root.id === paneId ? { ...root, sessionId } : root;
  }

  const children = root.children.map((child) =>
    updateLeafSession(child, paneId, sessionId),
  );

  if (hasSameChildren(root.children, children)) {
    return root;
  }

  return { ...root, children };
}

export function updateSplitRatio(
  root: PaneNode,
  splitId: string,
  index: number,
  delta: number,
): PaneNode {
  if (root.type === "leaf") return root;

  if (root.id === splitId) {
    const ratios = adjustAdjacentRatios(root.ratios, index, delta);
    return ratios === root.ratios ? root : { ...root, ratios };
  }

  const children = root.children.map((child) =>
    updateSplitRatio(child, splitId, index, delta),
  );

  if (hasSameChildren(root.children, children)) {
    return root;
  }

  return { ...root, children };
}

export function collectLeafIds(root: PaneNode): string[] {
  if (root.type === "leaf") return [root.id];
  return root.children.flatMap((child) => collectLeafIds(child));
}

export function migrateLegacyTree(node: unknown): PaneNode | null {
  if (!node || typeof node !== "object") return null;

  const candidate = node as {
    type?: unknown;
    id?: unknown;
    sessionId?: unknown;
    direction?: unknown;
    ratio?: unknown;
    ratios?: unknown;
    children?: unknown;
  };

  if (candidate.type === "leaf") {
    if (
      typeof candidate.id !== "string" ||
      (typeof candidate.sessionId !== "string" && candidate.sessionId !== null)
    ) {
      return null;
    }

    syncCounterFromId(candidate.id);

    return {
      type: "leaf",
      id: candidate.id,
      sessionId: candidate.sessionId,
    };
  }

  if (candidate.type !== "split") return null;
  if (
    typeof candidate.id !== "string" ||
    (candidate.direction !== "horizontal" && candidate.direction !== "vertical")
  ) {
    return null;
  }
  syncCounterFromId(candidate.id);
  if (!Array.isArray(candidate.children) || candidate.children.length < 2) {
    return null;
  }

  const children = candidate.children
    .map((child) => migrateLegacyTree(child))
    .filter((child): child is PaneNode => child !== null);

  if (children.length !== candidate.children.length || children.length < 2) {
    return null;
  }

  const ratios = Array.isArray(candidate.ratios)
    ? candidate.ratios
    : typeof candidate.ratio === "number"
      ? [candidate.ratio, 1 - candidate.ratio]
      : createEqualRatios(children.length);

  return flattenSameDirection({
    type: "split",
    id: candidate.id,
    direction: candidate.direction,
    children,
    ratios: normalizeRatios(ratios, children.length),
  });
}
