import { existsSync } from "fs";
import { execFileSync } from "child_process";
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

let cachedSessions: ClaudeSessionRow[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export function readClaudeSessions(): ClaudeSessionRow[] {
  const now = Date.now();
  if (cachedSessions && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSessions;
  }

  const home = process.env.HOME ?? "/root";
  const dbPath = join(home, ".claude", "dashboard.db");
  if (!existsSync(dbPath)) return [];

  try {
    const script = [
      "import sqlite3, json",
      `conn = sqlite3.connect("${dbPath}")`,
      "c = conn.cursor()",
      "rows = c.execute('SELECT id, project_id, slug, first_prompt, summary, input_tokens, output_tokens, cache_read_tokens, total_cost, created_at, modified_at FROM sessions ORDER BY modified_at DESC LIMIT 200').fetchall()",
      "cols = ['id','project_id','slug','first_prompt','summary','input_tokens','output_tokens','cache_read_tokens','total_cost','created_at','modified_at']",
      "print(json.dumps([dict(zip(cols,r)) for r in rows]))",
      "conn.close()",
    ].join("; ");

    const result = execFileSync("python3", ["-c", script], {
      encoding: "utf-8",
      timeout: 5000,
    });
    const parsed = JSON.parse(result.trim());
    cachedSessions = Array.isArray(parsed) ? parsed : [];
    cacheTimestamp = now;
    return cachedSessions;
  } catch (err) {
    console.error("[readClaudeSessions] error:", err);
    return cachedSessions ?? [];
  }
}
