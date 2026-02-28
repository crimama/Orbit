import { sshManager } from "@/server/ssh/sshManager";
import { shellQuote } from "@/lib/shellQuote";
import type { SessionInfo } from "@/lib/types";

function toProjectKey(projectPath: string): string {
  return projectPath.replace(/[\\/]/g, "-");
}

/**
 * Wrap a shell command to run inside a Docker container on the remote host.
 * Uses `docker exec` without -it flags since this is non-interactive.
 */
function wrapDocker(container: string, cmd: string): string {
  return `docker exec ${shellQuote(container)} /bin/bash -c ${shellQuote(cmd)}`;
}

/**
 * Scan Claude session history on a remote server via SSH.
 * Mirrors the local scanner pattern from claudeHistory.ts.
 * When dockerContainer is provided, commands are executed inside the container.
 */
export async function scanRemoteSessions(
  sshConfigId: string,
  projectId: string,
  projectName: string,
  projectPath: string,
  dockerContainer?: string,
): Promise<SessionInfo[]> {
  const status = sshManager.getStatus(sshConfigId);
  if (status.state !== "connected") {
    return [];
  }

  const exec = (cmd: string) =>
    sshManager.exec(
      sshConfigId,
      dockerContainer ? wrapDocker(dockerContainer, cmd) : cmd,
    );

  const keys = new Set<string>([toProjectKey(projectPath)]);
  try {
    const resolved = (
      await exec(
        `realpath ${shellQuote(projectPath)} 2>/dev/null || true`,
      )
    )
      .trim()
      .split("\n")[0]
      ?.trim();
    if (resolved) {
      keys.add(toProjectKey(resolved));
    }
  } catch {
    // Ignore realpath lookup failures; scan with original path key.
  }

  const dirs = Array.from(keys).map((key) => `$HOME/.claude/projects/${key}`);

  try {
    const sessionMap = new Map<string, SessionInfo>();
    const sessions: SessionInfo[] = [];
    for (const dir of dirs) {
      const listOutput = await exec(
        `if [ -d "${dir}" ]; then find "${dir}" -maxdepth 1 -name "*.jsonl" -printf "%T@ %f\\n" 2>/dev/null | sort -rn; fi`,
      );
      if (!listOutput.trim()) continue;

      const lines = listOutput.trim().split("\n");
      for (const line of lines) {
        const spaceIdx = line.indexOf(" ");
        if (spaceIdx === -1) continue;

        const timestamp = parseFloat(line.substring(0, spaceIdx));
        if (isNaN(timestamp)) continue;
        const filename = line.substring(spaceIdx + 1).trim();
        if (!filename.endsWith(".jsonl")) continue;

        const sessionRef = filename.replace(/\.jsonl$/, "");
        const existing = sessionMap.get(sessionRef);
        if (existing && existing.updatedAt >= new Date(timestamp * 1000).toISOString()) {
          continue;
        }

        let title: string | null = null;
        try {
          const headOutput = await exec(
            `head -20 "${dir}/${filename}" 2>/dev/null`,
          );

          for (const jsonLine of headOutput.split("\n")) {
            const raw = jsonLine.trim();
            if (!raw.startsWith("{")) continue;
            try {
              const parsed = JSON.parse(raw) as {
                type?: string;
                message?: { content?: string };
              };
              if (parsed.type !== "user") continue;
              const content = parsed.message?.content;
              if (!content) continue;
              const firstLine = content
                .split("\n")
                .find((v) => v.trim().length > 0);
              if (firstLine) {
                title = firstLine.slice(0, 120);
                break;
              }
            } catch {
              // Ignore malformed lines
            }
          }
        } catch {
          // Skip files we can't read
        }

        if (!title) {
          try {
            const grepResult = await exec(
              `grep -c '"type":"user"\\|"type": "user"' "${dir}/${filename}" 2>/dev/null || echo "0"`,
            );
            if (parseInt(grepResult.trim(), 10) === 0) continue;
          } catch {
            continue;
          }
        }

        const mtime = new Date(timestamp * 1000).toISOString();
        const session: SessionInfo = {
          id: `history:${sessionRef}`,
          projectId,
          projectName,
          projectColor: "#64748b",
          name: null,
          agentType: "claude-code",
          sessionRef,
          status: "paused",
          lastContext: title,
          createdAt: mtime,
          updatedAt: mtime,
          source: "claude-history",
        };
        sessionMap.set(sessionRef, session);
      }
    }

    sessions.push(...Array.from(sessionMap.values()));
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sessions;
  } catch (err) {
    console.error(
      `[RemoteScanner] Failed to scan remote sessions for ${sshConfigId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}
