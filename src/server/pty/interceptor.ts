import { randomUUID } from "crypto";
import {
  getActiveRules,
  getInterceptorMode,
} from "@/server/pty/interceptorRules";
import { INTERCEPTOR_AUTO_DENY_MS } from "@/lib/constants";
import type {
  PendingApproval,
  InterceptorWarning,
  InterceptorRuleInfo,
  InterceptorMode,
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

  /** Cached active rules + mode (refreshed every CACHE_TTL_MS) */
  private cachedRules: InterceptorRuleInfo[] | null = null;
  private cachedMode: InterceptorMode | null = null;
  private cacheTimestamp = 0;
  private modeCacheTimestamp = 0;
  private static readonly CACHE_TTL_MS = 10_000;

  /**
   * Intercept terminal input data for a session.
   * Returns true if the data should be forwarded to the PTY.
   * Returns false if the command was blocked (pending approval).
   *
   * Mode behavior:
   *   blacklist — only block/warn rules checked (original behavior)
   *   allowlist — allow match → pass, no match → auto-block
   *   hybrid    — allow match → pass, block/warn check, no match → pass
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

    // Get active rules + mode
    const rules = await this.getActiveRulesCached();
    const mode = await this.getModeCached();

    // Classify rules
    const allowRules = rules.filter((r) => r.severity === "allow");
    const blockWarnRules = rules.filter(
      (r) => r.severity === "block" || r.severity === "warn",
    );

    // Guard against ReDoS: truncate long commands
    const testInput = command.length > 1000 ? command.slice(0, 1000) : command;

    // --- Mode: blacklist — original behavior (allow rules ignored) ---
    if (mode === "blacklist") {
      return this.checkBlockWarn(
        sessionId,
        data,
        testInput,
        command,
        blockWarnRules,
        onPending,
        onWarn,
      );
    }

    // --- Mode: allowlist — allow match → pass, no match → auto-block ---
    if (mode === "allowlist") {
      if (this.matchesAny(testInput, allowRules)) {
        return true; // Safe command — pass immediately
      }
      // Not in allowlist → create auto-block pending approval
      return this.createBlock(sessionId, data, command, {
        id: "allowlist-deny",
        pattern: "*",
        description: "Command not in allowlist",
        severity: "block",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, onPending);
    }

    // --- Mode: hybrid (default) — allow → block/warn → pass ---
    if (this.matchesAny(testInput, allowRules)) {
      return true; // Safe command — pass immediately
    }

    return this.checkBlockWarn(
      sessionId,
      data,
      testInput,
      command,
      blockWarnRules,
      onPending,
      onWarn,
    );
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

  // --- Private helpers ---

  /** Test if command matches any rule in the list */
  private matchesAny(
    testInput: string,
    rules: InterceptorRuleInfo[],
  ): boolean {
    for (const rule of rules) {
      try {
        if (new RegExp(rule.pattern).test(testInput)) return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  /** Run block/warn rules against a command */
  private checkBlockWarn(
    sessionId: string,
    data: string,
    testInput: string,
    command: string,
    rules: InterceptorRuleInfo[],
    onPending: PendingCallback,
    onWarn: WarnCallback,
  ): boolean | Promise<boolean> {
    for (const rule of rules) {
      let matches = false;
      try {
        matches = new RegExp(rule.pattern).test(testInput);
      } catch {
        continue;
      }

      if (!matches) continue;

      if (rule.severity === "block") {
        this.createBlock(sessionId, data, command, rule, onPending);
        return false;
      }

      if (rule.severity === "warn") {
        onWarn({
          sessionId,
          command,
          matchedRule: rule,
          timestamp: new Date().toISOString(),
        });
        return true;
      }
    }

    return true; // No match — forward normally
  }

  /** Create a block pending approval and return false */
  private createBlock(
    sessionId: string,
    data: string,
    command: string,
    rule: InterceptorRuleInfo,
    onPending: PendingCallback,
  ): false {
    const approval: PendingApproval = {
      id: randomUUID(),
      sessionId,
      command,
      matchedRule: rule,
      timestamp: new Date().toISOString(),
    };

    const timer = setTimeout(() => {
      this.resolve(approval.id, false);
    }, INTERCEPTOR_AUTO_DENY_MS);

    this.pendingApprovals.set(approval.id, {
      ...approval,
      heldData: data,
      timer,
    });

    onPending(approval);
    return false;
  }

  /** Invalidate the cache (e.g., after mode or rule change). */
  invalidateCache(): void {
    this.cachedRules = null;
    this.cachedMode = null;
    this.cacheTimestamp = 0;
    this.modeCacheTimestamp = 0;
  }

  // --- Caching ---

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

  private async getModeCached(): Promise<InterceptorMode> {
    const now = Date.now();
    if (
      this.cachedMode &&
      now - this.modeCacheTimestamp < CommandInterceptor.CACHE_TTL_MS
    ) {
      return this.cachedMode;
    }

    this.cachedMode = await getInterceptorMode();
    this.modeCacheTimestamp = now;
    return this.cachedMode;
  }
}

export const commandInterceptor = new CommandInterceptor();
