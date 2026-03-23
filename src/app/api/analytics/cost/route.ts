import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

interface ClaudeSessionRow {
  id: string;
  project_id: string | null;
  slug: string | null;
  first_prompt: string | null;
  summary: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  total_cost: number;
  created_at: string;
  modified_at: string;
}

function readClaudeSessions(): ClaudeSessionRow[] {
  const home = process.env.HOME ?? "/root";
  const dbPath = join(home, ".claude", "dashboard.db");
  if (!existsSync(dbPath)) {
    console.log("[CostAPI] dashboard.db not found at", dbPath);
    return [];
  }

  try {
    const result = execSync(
      `python3 -c "
import sqlite3, json, sys
try:
    conn = sqlite3.connect('${dbPath}')
    c = conn.cursor()
    rows = c.execute('''
      SELECT id, project_id, slug, first_prompt, summary,
             input_tokens, output_tokens, cache_read_tokens, total_cost,
             created_at, modified_at
      FROM sessions ORDER BY modified_at DESC LIMIT 200
    ''').fetchall()
    cols = ['id','project_id','slug','first_prompt','summary','input_tokens','output_tokens','cache_read_tokens','total_cost','created_at','modified_at']
    print(json.dumps([dict(zip(cols,r)) for r in rows]))
    conn.close()
except Exception as e:
    print(json.dumps([]))
    print(str(e), file=sys.stderr)
"`,
      { encoding: "utf-8", timeout: 5000 },
    );
    const parsed = JSON.parse(result.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[CostAPI] Failed to read dashboard.db:", err);
    return [];
  }
}

export async function GET() {
  const sessions = readClaudeSessions();

  const mapped = sessions.map((cs) => ({
    sessionId: cs.id,
    sessionName:
      cs.summary?.slice(0, 60) ??
      cs.first_prompt?.slice(0, 60) ??
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
