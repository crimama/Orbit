import { prisma } from "@/lib/prisma";

const BUFFER_LIMIT = 4096;
// Claude Code: "Total cost: $1.23", "$1.23 cost", "Cost: $1.23"
const COST_PATTERN = /(?:Total cost|Cost):\s*\$([0-9.]+)|\$([0-9.]+)\s*(?:cost|spent|used)/gi;
// Claude Code: "tokens used\n45,454", "total_tokens: 12345", "Total tokens: 45,234"
const TOKENS_PATTERN = /(?:tokens?\s*used|total_tokens|Total tokens)[:\s]*\r?\n?\s*([\d,]+)/gi;
// Codex: "tokens used\n45,454"
const CODEX_TOKENS_PATTERN = /tokens used\s*\r?\n\s*([\d,]+)/gi;
// Claude Code session summary: "input: 1,234 tokens" / "output: 5,678 tokens"
const IO_TOKENS_PATTERN = /(?:input|output):\s*([\d,]+)\s*tokens?/gi;
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)/g;

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

class TokenTracker {
  private buffers = new Map<string, string>();

  private lastCost = new Map<string, number>();
  private lastTokens = new Map<string, number>();

  private sampleCounter = 0;

  async processOutput(sessionId: string, data: string): Promise<void> {
    const previous = this.buffers.get(sessionId) ?? "";
    const stripped = stripAnsi(data);
    const buffer = `${previous}${stripped}`.slice(-BUFFER_LIMIT);

    // DEBUG: sample every 100th chunk to see what data looks like
    if (++this.sampleCounter % 100 === 0) {
      const preview = stripped.slice(0, 200).replace(/\n/g, "\\n");
      console.log(`[TokenTracker:sample] ${sessionId.slice(0, 8)}: "${preview}"`);
    }

    let costFound: number | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let lastProcessedIndex = 0;

    // Match cost patterns
    const costPattern = new RegExp(COST_PATTERN);
    let match: RegExpExecArray | null;
    while ((match = costPattern.exec(buffer)) !== null) {
      const rawValue = match[1] ?? match[2];
      const val = Number.parseFloat(rawValue);
      if (Number.isFinite(val) && val > 0) {
        costFound = val;
        lastProcessedIndex = Math.max(lastProcessedIndex, match.index + match[0].length);
      }
    }

    // Match general token patterns
    for (const pattern of [TOKENS_PATTERN, CODEX_TOKENS_PATTERN]) {
      const re = new RegExp(pattern);
      while ((match = re.exec(buffer)) !== null) {
        const val = Number.parseInt(match[1].replaceAll(",", ""), 10);
        if (Number.isFinite(val) && val > 0) {
          outputTokens = Math.max(outputTokens, val);
          lastProcessedIndex = Math.max(lastProcessedIndex, match.index + match[0].length);
        }
      }
    }

    // Match input/output token breakdown
    const ioRe = new RegExp(IO_TOKENS_PATTERN);
    while ((match = ioRe.exec(buffer)) !== null) {
      const val = Number.parseInt(match[1].replaceAll(",", ""), 10);
      if (Number.isFinite(val) && val > 0) {
        const label = match[0].toLowerCase();
        if (label.startsWith("input")) {
          inputTokens = Math.max(inputTokens, val);
        } else {
          outputTokens = Math.max(outputTokens, val);
        }
        lastProcessedIndex = Math.max(lastProcessedIndex, match.index + match[0].length);
      }
    }

    this.buffers.set(
      sessionId,
      lastProcessedIndex > 0 ? buffer.slice(lastProcessedIndex) : buffer,
    );

    // Deduplicate: only log if values changed
    const prevCost = this.lastCost.get(sessionId) ?? 0;
    const prevTokens = this.lastTokens.get(sessionId) ?? 0;
    const totalTokens = inputTokens + outputTokens;

    const hasCostChange = costFound !== null && costFound !== prevCost;
    const hasTokenChange = totalTokens > 0 && totalTokens !== prevTokens;

    if (!hasCostChange && !hasTokenChange) return;

    if (costFound !== null) this.lastCost.set(sessionId, costFound);
    if (totalTokens > 0) this.lastTokens.set(sessionId, totalTokens);

    await prisma.sessionTokenLog.create({
      data: {
        sessionId,
        inputTokens,
        outputTokens,
        estimatedCost: costFound ?? 0,
      },
    });

    console.log(
      `[TokenTracker] ${sessionId.slice(0, 8)}: cost=$${costFound ?? 0}, in=${inputTokens}, out=${outputTokens}`,
    );
  }
}

export const tokenTracker = new TokenTracker();
