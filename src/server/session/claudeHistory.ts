import { createReadStream } from "fs";
import { readdir, realpath, stat } from "fs/promises";
import { homedir } from "os";
import { basename, join } from "path";
import readline from "readline";
import type { SessionInfo } from "@/lib/types";

function toClaudeProjectKey(projectPath: string): string {
  return projectPath.replace(/[\\/]/g, "-");
}

async function resolveProjectKeys(projectPath: string): Promise<string[]> {
  const keys = new Set<string>();
  const raw = projectPath.trim();
  if (!raw) return [];

  keys.add(toClaudeProjectKey(raw));

  // Symlink/alias-safe lookup, e.g. /Volume/foo -> /home/user/Volume/foo.
  try {
    const resolved = await realpath(raw);
    if (resolved.trim().length > 0) {
      keys.add(toClaudeProjectKey(resolved));
    }
  } catch {
    // Path may not exist locally; keep raw key only.
  }

  return Array.from(keys);
}

async function extractTitle(jsonlPath: string): Promise<string | null> {
  const stream = createReadStream(jsonlPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      const raw = line.trim();
      if (!raw.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(raw) as {
          type?: string;
          message?: { content?: string };
        };
        if (parsed.type !== "user") continue;
        const content = parsed.message?.content;
        if (!content) continue;
        const firstLine = content.split("\n").find((v) => v.trim().length > 0);
        if (firstLine) return firstLine.slice(0, 120);
      } catch {
        // Ignore malformed lines and continue.
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  return null;
}

async function hasUserTurn(jsonlPath: string): Promise<boolean> {
  const stream = createReadStream(jsonlPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      const raw = line.trim();
      if (!raw.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(raw) as { type?: string };
        if (parsed.type === "user") return true;
      } catch {
        // Ignore malformed lines and continue.
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  return false;
}

export async function listClaudeHistorySessions(
  projectId: string,
  projectName: string,
  projectPath: string,
): Promise<SessionInfo[]> {
  const keys = await resolveProjectKeys(projectPath);
  const dirs = keys.map((key) => join(homedir(), ".claude", "projects", key));

  const entryMap = new Map<string, { name: string; path: string; mtime: Date }>();
  for (const dir of dirs) {
    try {
      const files = await readdir(dir, { withFileTypes: true });
      const jsonls = files.filter((f) => f.isFile() && f.name.endsWith(".jsonl"));
      const entries = await Promise.all(
        jsonls.map(async (f) => {
          const filePath = join(dir, f.name);
          const info = await stat(filePath);
          return { name: f.name, path: filePath, mtime: info.mtime };
        }),
      );
      for (const entry of entries) {
        // Same sessionRef can appear in multiple aliases; keep the newest.
        const sessionRef = basename(entry.name, ".jsonl");
        const prev = entryMap.get(sessionRef);
        if (!prev || entry.mtime > prev.mtime) {
          entryMap.set(sessionRef, entry);
        }
      }
    } catch {
      // Ignore missing key directory and continue.
    }
  }

  const entries = Array.from(entryMap.values());
  if (entries.length === 0) return [];

  const sessions = await Promise.all(
    entries.map(async (entry): Promise<SessionInfo | null> => {
      if (!(await hasUserTurn(entry.path))) {
        return null;
      }
      const sessionRef = basename(entry.name, ".jsonl");
      const title = await extractTitle(entry.path);

      return {
        id: `history:${sessionRef}`,
        projectId,
        projectName,
        projectColor: "#64748b",
        name: null,
        agentType: "claude-code",
        sessionRef,
        status: "paused",
        lastContext: title,
        createdAt: entry.mtime.toISOString(),
        updatedAt: entry.mtime.toISOString(),
        source: "claude-history",
      };
    }),
  );

  const filtered = sessions.filter((s): s is SessionInfo => s !== null);
  filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return filtered;
}
