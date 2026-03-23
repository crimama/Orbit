import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";

interface ClaudeSession {
  id: string;
  project_id: string | null;
  slug: string | null;
  first_prompt: string | null;
  summary: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  total_cost: number;
  model_usage: string | null;
  created_at: string;
  modified_at: string;
}

function getClaudeDashboardDb(): string | null {
  const home = process.env.HOME ?? "/root";
  const dbPath = join(home, ".claude", "dashboard.db");
  return existsSync(dbPath) ? dbPath : null;
}

function readClaudeSessions(): ClaudeSession[] {
  const dbPath = getClaudeDashboardDb();
  if (!dbPath) return [];

  try {
    // Use better-sqlite3 if available, otherwise fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .prepare(
        `SELECT id, project_id, slug, first_prompt, summary,
                input_tokens, output_tokens, cache_read_tokens, total_cost,
                model_usage, created_at, modified_at
         FROM sessions
         ORDER BY modified_at DESC
         LIMIT 200`,
      )
      .all() as ClaudeSession[];
    db.close();
    return rows;
  } catch {
    // Fallback: try reading via child_process + python
    try {
      const { execSync } = await import("child_process");
      const result = execSync(
        `python3 -c "
import sqlite3, json
conn = sqlite3.connect('${dbPath}')
c = conn.cursor()
rows = c.execute('''
  SELECT id, project_id, slug, first_prompt, summary,
         input_tokens, output_tokens, cache_read_tokens, total_cost,
         model_usage, created_at, modified_at
  FROM sessions ORDER BY modified_at DESC LIMIT 200
''').fetchall()
cols = ['id','project_id','slug','first_prompt','summary','input_tokens','output_tokens','cache_read_tokens','total_cost','model_usage','created_at','modified_at']
print(json.dumps([dict(zip(cols,r)) for r in rows]))
conn.close()
"`,
        { encoding: "utf-8", timeout: 5000 },
      );
      return JSON.parse(result.trim()) as ClaudeSession[];
    } catch {
      return [];
    }
  }
}

export async function GET(request: Request) {
  // Read from Claude Code's dashboard.db
  const claudeSessions = readClaudeSessions();

  // Also read from Orbit's own SessionTokenLog
  const orbitLogs = await prisma.sessionTokenLog.groupBy({
    by: ["sessionId"],
    _sum: { estimatedCost: true, inputTokens: true, outputTokens: true },
  });
  const orbitMap = new Map(
    orbitLogs.map((l) => [
      l.sessionId,
      {
        cost: l._sum.estimatedCost ?? 0,
        input: l._sum.inputTokens ?? 0,
        output: l._sum.outputTokens ?? 0,
      },
    ]),
  );

  // Merge: Claude sessions as primary, Orbit logs as supplement
  const sessions = claudeSessions.map((cs) => {
    const orbitData = orbitMap.get(cs.id);
    return {
      sessionId: cs.id,
      sessionName: cs.summary?.slice(0, 60) ?? cs.first_prompt?.slice(0, 60) ?? cs.slug ?? cs.id.slice(0, 8),
      projectId: cs.project_id,
      agentType: "claude-code",
      totalInputTokens: cs.input_tokens ?? 0,
      totalOutputTokens: cs.output_tokens ?? 0,
      cacheReadTokens: cs.cache_read_tokens ?? 0,
      totalCost: cs.total_cost ?? orbitData?.cost ?? 0,
      totalTokens: (cs.input_tokens ?? 0) + (cs.output_tokens ?? 0),
      createdAt: cs.created_at,
      modifiedAt: cs.modified_at,
    };
  });

  const totalCost = sessions.reduce((s, e) => s + e.totalCost, 0);

  return NextResponse.json({
    data: {
      source: claudeSessions.length > 0 ? "claude-dashboard" : "orbit",
      totalCost,
      sessions,
    },
  });
}
