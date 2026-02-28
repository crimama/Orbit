import { getPtyBackend } from "@/server/pty/ptyBackend";
import { OBS_EXTRACT_BUFFER_MAX, OBS_EXTRACT_DEBOUNCE_MS } from "@/lib/constants";
import type { SessionEvent, SessionEventType } from "@/lib/types";

let eventCounter = 0;

function nextEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

interface EventPattern {
  type: SessionEventType;
  regex: RegExp;
}

const EVENT_PATTERNS: EventPattern[] = [
  { type: "file_edit", regex: /Writ(?:e|ing|ten)\s+\S+/i },
  { type: "tool_call", regex: /⚡|Using tool:|ToolCall:/i },
  { type: "command_run", regex: /^\$\s+|Running:|Executing:/m },
  { type: "test_result", regex: /\d+ tests? passed|PASS|FAIL/i },
  { type: "error", regex: /Error:|ERROR:|FATAL:|panic:/i },
];

/** Strip ANSI escape sequences from terminal output */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)/g, "");
}

/**
 * Start extracting structured events from PTY output for a session.
 * Returns a cleanup function to stop extraction.
 */
export function startEventExtraction(
  sessionId: string,
  onEvent: (event: SessionEvent) => void,
): () => void {
  let destroyed = false;
  let unsubData: (() => void) | null = null;
  let buffer = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function processBuffer() {
    if (destroyed || buffer.length === 0) return;

    const clean = stripAnsi(buffer);
    buffer = "";

    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);

    for (const line of lines) {
      for (const pattern of EVENT_PATTERNS) {
        if (pattern.regex.test(line)) {
          onEvent({
            id: nextEventId(),
            sessionId,
            type: pattern.type,
            summary: line.trim().slice(0, 200),
            raw: line.slice(0, 500),
            timestamp: new Date().toISOString(),
          });
          break; // first matching pattern wins
        }
      }
    }
  }

  function handleData(data: string) {
    if (destroyed) return;

    buffer += data;
    if (buffer.length > OBS_EXTRACT_BUFFER_MAX) {
      buffer = buffer.slice(-OBS_EXTRACT_BUFFER_MAX);
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processBuffer, OBS_EXTRACT_DEBOUNCE_MS);
  }

  // Subscribe to PTY backend
  const backend = getPtyBackend(sessionId);
  if (backend) {
    try {
      unsubData = backend.onData(sessionId, handleData);
    } catch {
      // Session may not exist in backend yet
    }
  }

  return () => {
    destroyed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (unsubData) {
      unsubData();
      unsubData = null;
    }
  };
}
