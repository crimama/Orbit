import { OBS_MAX_RECENT_EVENTS } from "@/lib/constants";
import type {
  SessionEvent,
  SessionEventType,
  SessionMetrics,
  SessionMetricsSnapshot,
} from "@/lib/types";

const EVENT_TYPES: SessionEventType[] = [
  "file_edit",
  "command_run",
  "test_result",
  "error",
  "tool_call",
  "info",
];

function emptyMetrics(sessionId: string): SessionMetrics {
  const counts = {} as Record<SessionEventType, number>;
  for (const t of EVENT_TYPES) counts[t] = 0;

  const now = new Date().toISOString();
  return {
    sessionId,
    eventCounts: counts,
    totalEvents: 0,
    errorRate: 0,
    activeDurationMs: 0,
    lastActivityAt: now,
    startedAt: now,
  };
}

interface SessionStore {
  metrics: SessionMetrics;
  recentEvents: SessionEvent[];
}

class SessionMetricsManager {
  private store = new Map<string, SessionStore>();

  private getOrCreate(sessionId: string): SessionStore {
    let entry = this.store.get(sessionId);
    if (!entry) {
      entry = { metrics: emptyMetrics(sessionId), recentEvents: [] };
      this.store.set(sessionId, entry);
    }
    return entry;
  }

  /** Record an event and return updated snapshot */
  record(event: SessionEvent): SessionMetricsSnapshot {
    const entry = this.getOrCreate(event.sessionId);
    const m = entry.metrics;

    // Update counters
    m.eventCounts[event.type] = (m.eventCounts[event.type] ?? 0) + 1;
    m.totalEvents++;
    m.errorRate = m.totalEvents > 0 ? m.eventCounts.error / m.totalEvents : 0;
    m.lastActivityAt = event.timestamp;
    m.activeDurationMs =
      new Date(event.timestamp).getTime() - new Date(m.startedAt).getTime();

    // Ring buffer for recent events
    entry.recentEvents.push(event);
    if (entry.recentEvents.length > OBS_MAX_RECENT_EVENTS) {
      entry.recentEvents.shift();
    }

    return { metrics: { ...m }, recentEvents: [...entry.recentEvents] };
  }

  /** Get current snapshot (with up-to-date duration) */
  getSnapshot(sessionId: string): SessionMetricsSnapshot {
    const entry = this.store.get(sessionId);
    if (!entry) {
      return { metrics: emptyMetrics(sessionId), recentEvents: [] };
    }

    const m = { ...entry.metrics };
    m.activeDurationMs =
      Date.now() - new Date(m.startedAt).getTime();

    return { metrics: m, recentEvents: [...entry.recentEvents] };
  }

  /** Clear metrics for a session (on session destroy) */
  clear(sessionId: string): void {
    this.store.delete(sessionId);
  }

  has(sessionId: string): boolean {
    return this.store.has(sessionId);
  }
}

export const sessionMetricsManager = new SessionMetricsManager();
