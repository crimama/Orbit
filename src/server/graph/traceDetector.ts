import { getPtyBackend } from "@/server/pty/ptyBackend";
import { graphManager } from "@/server/graph/graphManager";
import type { SkillNodeInfo, SkillNodeStatus, SkillTrace } from "@/lib/types";

/** Debounce interval to avoid trace spam (ms) */
const TRACE_DEBOUNCE_MS = 500;

/** Auto-reset to idle after no activity (ms) */
const AUTO_RESET_MS = 5_000;

type TraceCallback = (trace: SkillTrace) => void;

interface TrackedSkill {
  id: string;
  name: string;
  mcpEndpoint: string | null;
  namePattern: RegExp;
  mcpPattern: RegExp | null;
}

/**
 * Start monitoring PTY output for skill invocations.
 * Returns a cleanup function to stop monitoring.
 */
export function startTrace(
  sessionId: string,
  projectId: string,
  onTrace: TraceCallback,
): () => void {
  let destroyed = false;
  let unsubData: (() => void) | null = null;
  const skillStates = new Map<string, SkillNodeStatus>();
  const lastEmitTime = new Map<string, number>();
  const resetTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function emitTrace(skillId: string, status: SkillNodeStatus) {
    if (destroyed) return;

    const now = Date.now();
    const lastEmit = lastEmitTime.get(skillId) ?? 0;
    if (now - lastEmit < TRACE_DEBOUNCE_MS && status === skillStates.get(skillId)) {
      return;
    }

    skillStates.set(skillId, status);
    lastEmitTime.set(skillId, now);

    onTrace({
      skillId,
      projectId,
      status,
      timestamp: new Date().toISOString(),
    });

    // Schedule auto-reset to idle
    const existing = resetTimers.get(skillId);
    if (existing) clearTimeout(existing);

    if (status === "running") {
      resetTimers.set(
        skillId,
        setTimeout(() => {
          if (!destroyed) {
            emitTrace(skillId, "idle");
          }
        }, AUTO_RESET_MS),
      );
    }
  }

  function buildPatterns(skills: SkillNodeInfo[]): TrackedSkill[] {
    return skills.map((s) => ({
      id: s.id,
      name: s.name,
      mcpEndpoint: s.mcpEndpoint,
      namePattern: new RegExp(escapeRegex(s.name), "i"),
      mcpPattern: s.mcpEndpoint
        ? new RegExp(escapeRegex(s.mcpEndpoint), "i")
        : null,
    }));
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Buffer for partial output chunks
  let outputBuffer = "";
  const BUFFER_MAX = 4096;

  function handleData(trackedSkills: TrackedSkill[], data: string) {
    outputBuffer += data;
    if (outputBuffer.length > BUFFER_MAX) {
      outputBuffer = outputBuffer.slice(-BUFFER_MAX);
    }

    for (const skill of trackedSkills) {
      const matched =
        skill.namePattern.test(data) ||
        (skill.mcpPattern !== null && skill.mcpPattern.test(data));

      if (!matched) continue;

      const currentStatus = skillStates.get(skill.id) ?? "idle";

      // Detect completion/error patterns in the buffered output
      if (/error|failed|exception/i.test(data)) {
        emitTrace(skill.id, "error");
      } else if (
        /done|complete|success|finished/i.test(data) &&
        currentStatus === "running"
      ) {
        emitTrace(skill.id, "success");
      } else if (currentStatus !== "running") {
        emitTrace(skill.id, "running");
      }
    }
  }

  // Initialize asynchronously
  void (async () => {
    if (destroyed) return;

    const skills = await graphManager.getSkillsByProject(projectId);
    if (destroyed || skills.length === 0) return;

    const trackedSkills = buildPatterns(skills);

    const backend = getPtyBackend(sessionId);
    if (!backend || destroyed) return;

    try {
      unsubData = backend.onData(sessionId, (data) => {
        handleData(trackedSkills, data);
      });
    } catch {
      // Session may not exist in backend yet — silently skip
    }
  })();

  return () => {
    destroyed = true;
    if (unsubData) {
      unsubData();
      unsubData = null;
    }
    for (const timer of Array.from(resetTimers.values())) {
      clearTimeout(timer);
    }
    resetTimers.clear();
    skillStates.clear();
    lastEmitTime.clear();
  };
}
