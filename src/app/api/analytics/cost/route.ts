import { NextResponse } from "next/server";
import { readClaudeSessions } from "@/server/claude/readDashboard";

export async function GET() {
  const sessions = readClaudeSessions();

  const mapped = sessions.map((cs) => ({
    sessionId: cs.id,
    sessionName:
      cs.summary?.slice(0, 120) ??
      cs.first_prompt?.slice(0, 120) ??
      cs.slug ??
      cs.id.slice(0, 8),
    projectId: cs.project_id,
    agentType: "claude-code",
    totalInputTokens: cs.input_tokens ?? 0,
    totalOutputTokens: cs.output_tokens ?? 0,
    cacheReadTokens: cs.cache_read_tokens ?? 0,
    totalCost: cs.total_cost ?? 0,
    totalTokens: (cs.input_tokens ?? 0) + (cs.output_tokens ?? 0),
    createdAt: cs.created_at,
    modifiedAt: cs.modified_at,
  }));

  const totalCost = mapped.reduce((s, e) => s + e.totalCost, 0);

  return NextResponse.json({
    data: {
      source: sessions.length > 0 ? "claude-dashboard" : "none",
      totalCost,
      sessions: mapped,
    },
  });
}
