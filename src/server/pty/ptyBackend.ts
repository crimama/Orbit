/** Common interface for local and remote PTY backends */
export interface PtyBackend {
  has(id: string): boolean;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  getScrollback(id: string): string;
  onData(id: string, cb: (data: string) => void): () => void;
  onExit(id: string, cb: (code: number) => void): () => void;
  destroy(id: string): void;
  getIdleSessions(maxIdleMs: number): { id: string }[];
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
