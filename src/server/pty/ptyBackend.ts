/** Common interface for local and remote PTY backends */
export interface PtyBackend {
  has(id: string): boolean;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  getScrollback(id: string): string;
  getScreenPreview(id: string, lines?: number): string;
  onData(id: string, cb: (data: string) => void): () => void;
  onExit(id: string, cb: (code: number) => void): () => void;
  destroy(id: string): void;
  getIdleSessions(maxIdleMs: number): { id: string }[];
  isReady(id: string): boolean;
  onReady(id: string, cb: () => void): () => void;
}

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*[A-Za-z]/g;
const DEFAULT_PREVIEW_LINES = 5;

export function getScreenPreviewFromScrollback(
  scrollback: string,
  lines = DEFAULT_PREVIEW_LINES,
): string {
  const safeLines = Math.max(1, Math.floor(lines) || DEFAULT_PREVIEW_LINES);
  const normalized = scrollback
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(/\r/g, "");
  const previewLines = normalized.split("\n");

  while (
    previewLines.length > 0 &&
    previewLines[previewLines.length - 1] === ""
  ) {
    previewLines.pop();
  }

  return previewLines.slice(-safeLines).join("\n");
}

// Registry of backends for unified lookup
const backends: PtyBackend[] = [];

export function registerPtyBackend(backend: PtyBackend): void {
  backends.push(backend);
}

/** Look up the backend that owns a given session ID */
export function getPtyBackend(sessionId: string): PtyBackend | null {
  for (const b of backends) {
    if (b.has(sessionId)) return b;
  }
  return null;
}
