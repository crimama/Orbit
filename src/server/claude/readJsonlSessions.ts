import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

export interface JsonlSessionSummary {
  sessionId: string;
  projectId: string;
  projectName: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
  firstPrompt: string | null;
  createdAt: string;
  modifiedAt: string;
}

// Claude Code model pricing (per 1M tokens, USD)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-6": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
};

const DEFAULT_PRICING = MODEL_PRICING["claude-sonnet-4-6"];

export function estimateCost(
  model: string | null,
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite: number,
): number {
  const p = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
  return (
    (input / 1_000_000) * p.input +
    (output / 1_000_000) * p.output +
    (cacheRead / 1_000_000) * p.cacheRead +
    (cacheWrite / 1_000_000) * p.cacheWrite
  );
}

let cachedResult: JsonlSessionSummary[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 30_000;

export function readJsonlSessions(): JsonlSessionSummary[] {
  const now = Date.now();
  if (cachedResult && now - cacheTs < CACHE_TTL) return cachedResult;

  const home = process.env.HOME ?? "/root";
  const projectsDir = join(home, ".claude", "projects");
  if (!existsSync(projectsDir)) return [];

  try {
    // Use python for fast batch processing of all JSONL files
    const script = [
      "import os, json, sys",
      `projects_dir = "${projectsDir}"`,
      "results = []",
      "for proj in os.listdir(projects_dir):",
      "    proj_path = os.path.join(projects_dir, proj)",
      "    if not os.path.isdir(proj_path): continue",
      "    for fname in os.listdir(proj_path):",
      "        if not fname.endswith('.jsonl'): continue",
      "        fpath = os.path.join(proj_path, fname)",
      "        sid = fname[:-6]",
      "        inp=0; out=0; cr=0; cw=0; mc=0; model=None; fp=None; first_ts=None; last_ts=None",
      "        try:",
      "            with open(fpath) as f:",
      "                for line in f:",
      "                    d = json.loads(line)",
      "                    ts = d.get('timestamp')",
      "                    if ts and not first_ts: first_ts = ts",
      "                    if ts: last_ts = ts",
      "                    if d.get('type') == 'user' and not fp:",
      "                        msg = d.get('message',{})",
      "                        if isinstance(msg, dict):",
      "                            c = msg.get('content','')",
      "                            if isinstance(c, str): fp = c[:120]",
      "                            elif isinstance(c, list) and c:",
      "                                for b in c:",
      "                                    if isinstance(b,dict) and b.get('type')=='text':",
      "                                        fp = b.get('text','')[:120]; break",
      "                    if d.get('type') == 'assistant':",
      "                        u = d.get('message',{}).get('usage',{})",
      "                        model = d.get('message',{}).get('model', model)",
      "                        inp += u.get('input_tokens',0)",
      "                        out += u.get('output_tokens',0)",
      "                        cr += u.get('cache_read_input_tokens',0)",
      "                        cc = u.get('cache_creation',{})",
      "                        cw += cc.get('ephemeral_1h_input_tokens',0) + cc.get('ephemeral_5m_input_tokens',0)",
      "                        mc += 1",
      "        except: continue",
      "        if mc == 0: continue",
      "        results.append({'sessionId':sid,'projectId':proj,'model':model,'inputTokens':inp,'outputTokens':out,'cacheReadTokens':cr,'cacheWriteTokens':cw,'messageCount':mc,'firstPrompt':fp,'createdAt':first_ts or '','modifiedAt':last_ts or ''})",
      "results.sort(key=lambda x: x['modifiedAt'], reverse=True)",
      "print(json.dumps(results[:200]))",
    ].join("\n");

    const result = execFileSync("python3", ["-c", script], {
      encoding: "utf-8",
      timeout: 15000,
    });

    const parsed = JSON.parse(result.trim()) as Array<{
      sessionId: string;
      projectId: string;
      model: string | null;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      messageCount: number;
      firstPrompt: string | null;
      createdAt: string;
      modifiedAt: string;
    }>;

    cachedResult = parsed.map((r) => ({
      ...r,
      projectName: r.projectId
        .replace(/^-home-[^-]+-/, "")
        .replace(/-/g, "/") || r.projectId,
    }));
    cacheTs = now;
    return cachedResult;
  } catch (err) {
    console.error("[readJsonlSessions] error:", err);
    return cachedResult ?? [];
  }
}
