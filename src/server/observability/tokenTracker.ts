import { prisma } from "@/lib/prisma";

const BUFFER_LIMIT = 4096;
const COST_PATTERN = /Total cost:\s*\$([0-9.]+)|total_cost_usd["'\s:=]+([0-9.]+)/gi;
const TOKENS_PATTERN = /tokens used\s*\r?\n\s*([\d,]+)/gi;
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)/g;

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

class TokenTracker {
  private buffers = new Map<string, string>();

  async processOutput(sessionId: string, data: string): Promise<void> {
    const previous = this.buffers.get(sessionId) ?? "";
    const buffer = `${previous}${stripAnsi(data)}`.slice(-BUFFER_LIMIT);
    const logs: Array<{
      estimatedCost?: number;
      outputTokens?: number;
    }> = [];

    let lastProcessedIndex = 0;

    const costPattern = new RegExp(COST_PATTERN);
    let match: RegExpExecArray | null;
    while ((match = costPattern.exec(buffer)) !== null) {
      const rawValue = match[1] ?? match[2];
      const estimatedCost = Number.parseFloat(rawValue);
      if (Number.isFinite(estimatedCost)) {
        logs.push({ estimatedCost });
        lastProcessedIndex = Math.max(
          lastProcessedIndex,
          (match.index ?? 0) + match[0].length,
        );
      }
    }

    const tokensPattern = new RegExp(TOKENS_PATTERN);
    while ((match = tokensPattern.exec(buffer)) !== null) {
      const outputTokens = Number.parseInt(match[1].replaceAll(",", ""), 10);
      if (Number.isFinite(outputTokens)) {
        logs.push({ outputTokens });
        lastProcessedIndex = Math.max(
          lastProcessedIndex,
          (match.index ?? 0) + match[0].length,
        );
      }
    }

    this.buffers.set(
      sessionId,
      lastProcessedIndex > 0 ? buffer.slice(lastProcessedIndex) : buffer,
    );

    if (logs.length === 0) {
      return;
    }

    await prisma.sessionTokenLog.createMany({
      data: logs.map((log) => ({
        sessionId,
        inputTokens: 0,
        outputTokens: log.outputTokens ?? 0,
        estimatedCost: log.estimatedCost ?? 0,
      })),
    });
  }
}

export const tokenTracker = new TokenTracker();
