import { randomUUID } from "crypto";
import { getActiveRules } from "@/server/pty/interceptorRules";
import { INTERCEPTOR_AUTO_DENY_MS } from "@/lib/constants";
import type {
  PendingApproval,
  InterceptorWarning,
  InterceptorRuleInfo,
} from "@/lib/types";

interface HeldApproval extends PendingApproval {
  heldData: string;
  timer: ReturnType<typeof setTimeout>;
}

type PendingCallback = (approval: PendingApproval) => void;
type WarnCallback = (warning: InterceptorWarning) => void;

class CommandInterceptor {
  /** Per-session input accumulator — collects keystrokes until Enter */
  private inputBuffers = new Map<string, string>();

  /** Approvals waiting for user decision */
  private pendingApprovals = new Map<string, HeldApproval>();

  /** Cached active rules (refreshed per intercept call) */
  private cachedRules: InterceptorRuleInfo[] | null = null;
  private cacheTimestamp = 0;
  private static readonly CACHE_TTL_MS = 10_000;

  /**
   * Intercept terminal input data for a session.
   * Returns true if the data should be forwarded to the PTY.
   * Returns false if the command was blocked (pending approval).
   */
  async intercept(
    sessionId: string,
    data: string,
    onPending: PendingCallback,
    onWarn: WarnCallback,
  ): Promise<boolean> {
    // Accumulate input
    let buffer = this.inputBuffers.get(sessionId) ?? "";
    buffer += data;
    this.inputBuffers.set(sessionId, buffer);

    // Check for Enter key (\r or \n)
    if (!data.includes("\r") && !data.includes("\n")) {
      return true; // No command submitted yet — forward input normally
    }

    // Extract command from buffer (strip trailing newline chars)
    const command = buffer.replace(/[\r\n]+$/, "").trim();
    this.inputBuffers.set(sessionId, "");

    if (!command) {
      return true; // Empty command — forward normally
    }

    // Get active rules
    const rules = await this.getActiveRulesCached();

    for (const rule of rules) {
      let matches = false;
      try {
        const regex = new RegExp(rule.pattern);
        matches = regex.test(command);
      } catch {
        // Invalid regex pattern — skip rule
        continue;
      }

      if (!matches) continue;

      if (rule.severity === "block") {
        const approval: PendingApproval = {
          id: randomUUID(),
          sessionId,
          command,
          matchedRule: rule,
          timestamp: new Date().toISOString(),
        };

        // Auto-deny timer
        const timer = setTimeout(() => {
          this.resolve(approval.id, false);
        }, INTERCEPTOR_AUTO_DENY_MS);

        this.pendingApprovals.set(approval.id, {
          ...approval,
          heldData: data,
          timer,
        });

        onPending(approval);
        return false; // Block — don't forward to PTY
      }

      if (rule.severity === "warn") {
        const warning: InterceptorWarning = {
          sessionId,
          command,
          matchedRule: rule,
          timestamp: new Date().toISOString(),
        };
        onWarn(warning);
        return true; // Warn but forward
      }
    }

    return true; // No match — forward normally
  }

  /**
   * Resolve a pending approval.
   * Returns the held data if approved, null if denied.
   */
  resolve(
    approvalId: string,
    approved: boolean,
  ): { sessionId: string; data: string } | null {
    const held = this.pendingApprovals.get(approvalId);
    if (!held) return null;

    clearTimeout(held.timer);
    this.pendingApprovals.delete(approvalId);

    if (approved) {
      return { sessionId: held.sessionId, data: held.heldData };
    }

    return null;
  }

  /**
   * List all currently pending approvals.
   */
  getPending(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values()).map((held) => ({
      id: held.id,
      sessionId: held.sessionId,
      command: held.command,
      matchedRule: held.matchedRule,
      timestamp: held.timestamp,
    }));
  }

  /**
   * Clear the input buffer for a session (e.g., on detach).
   */
  clearBuffer(sessionId: string): void {
    this.inputBuffers.delete(sessionId);
  }

  private async getActiveRulesCached(): Promise<InterceptorRuleInfo[]> {
    const now = Date.now();
    if (
      this.cachedRules &&
      now - this.cacheTimestamp < CommandInterceptor.CACHE_TTL_MS
    ) {
      return this.cachedRules;
    }

    this.cachedRules = await getActiveRules();
    this.cacheTimestamp = now;
    return this.cachedRules;
  }
}

export const commandInterceptor = new CommandInterceptor();
