import { NextResponse } from "next/server";
import { readJsonlSessions, estimateCost } from "@/server/claude/readJsonlSessions";

export async function GET() {
  const sessions = readJsonlSessions();

  const mapped = sessions.map((s) => ({
    sessionId: s.sessionId,
    sessionName: s.firstPrompt || s.sessionId.slice(0, 8),
    projectId: s.projectId,
    projectName: s.projectName,
    agentType: "claude-code",
    model: s.model,
    totalInputTokens: s.inputTokens,
    totalOutputTokens: s.outputTokens,
    cacheReadTokens: s.cacheReadTokens,
    cacheWriteTokens: s.cacheWriteTokens,
    totalTokens: s.inputTokens + s.outputTokens,
    totalCost: estimateCost(
      s.model,
      s.inputTokens,
      s.outputTokens,
      s.cacheReadTokens,
      s.cacheWriteTokens,
    ),
    messageCount: s.messageCount,
    createdAt: s.createdAt,
    modifiedAt: s.modifiedAt,
  }));

  const totalCost = mapped.reduce((sum, e) => sum + e.totalCost, 0);

  return NextResponse.json({
    data: {
      source: "jsonl",
      totalCost,
      sessions: mapped,
    },
  });
}
