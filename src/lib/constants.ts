/** Socket.io server path */
export const SOCKET_PATH = "/api/socketio";

/** Default PTY columns */
export const DEFAULT_COLS = 80;

/** Default PTY rows */
export const DEFAULT_ROWS = 24;

/** Default shell — use user's shell or fallback */
export const DEFAULT_SHELL =
  process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "bash");

/** Scrollback buffer max characters per session */
export const SCROLLBACK_LIMIT = 50_000;

/** GC interval: check every 1 hour */
export const GC_INTERVAL_MS = 60 * 60 * 1000;

/** GC idle threshold: 24 hours of inactivity */
export const GC_IDLE_MS = 24 * 60 * 60 * 1000;

/** Default server port */
export const DEFAULT_PORT = 3000;

// --- Phase 2: SSH & PWA ---

/** SSH connection timeout (ms) */
export const SSH_CONNECT_TIMEOUT_MS = 15_000;

/** SSH keepalive interval (ms) */
export const SSH_KEEPALIVE_INTERVAL_MS = 30_000;

/** SSH reconnect max retries */
export const SSH_RECONNECT_MAX_RETRIES = 5;

/** SSH reconnect base delay (ms) — exponential backoff */
export const SSH_RECONNECT_BASE_DELAY_MS = 1_000;

// --- Phase 3: Skill Graph ---

/** Default skill node width (px) */
export const SKILL_NODE_WIDTH = 200;

/** Default skill node height (px) */
export const SKILL_NODE_HEIGHT = 80;

/** Graph autosave debounce (ms) */
export const GRAPH_AUTOSAVE_DEBOUNCE_MS = 1_000;

// --- Phase 4: Interceptor & Delta ---

/** Minimum payload size (bytes) to apply delta compression */
export const DELTA_MIN_PAYLOAD_BYTES = 256;

/** Auto-deny timeout for pending approvals (ms) */
export const INTERCEPTOR_AUTO_DENY_MS = 30_000;

/** Default dangerous command patterns */
export const DEFAULT_DANGEROUS_PATTERNS = [
  { pattern: "rm\\s+-[^\\s]*r[^\\s]*f|rm\\s+-[^\\s]*f[^\\s]*r", description: "Recursive force delete", severity: "block" as const },
  { pattern: "rm\\s+-rf\\s+/\\s*$|rm\\s+-rf\\s+/[^\\w]", description: "Delete root filesystem", severity: "block" as const },
  { pattern: "mkfs\\.", description: "Format filesystem", severity: "block" as const },
  { pattern: "dd\\s+if=", description: "Direct disk write", severity: "warn" as const },
  { pattern: ":\\(\\)\\{\\s*:\\|:\\s*&\\s*\\}\\s*;\\s*:", description: "Fork bomb", severity: "block" as const },
  { pattern: "chmod\\s+-R\\s+777\\s+/", description: "Recursive chmod 777 on root", severity: "block" as const },
  { pattern: ">(\\s+)?/dev/sda", description: "Write directly to disk device", severity: "block" as const },
];
