# Task: Fix session resume: remove --fork-session, capture Claude session ID

## Agent
agent-01

## Status
pending

## Description
Fix the session resume flow in sessionManager.ts so that sessions properly resume after server restart.

## Problems to fix:

### 1. Remove --fork-session from all resume paths (4 locations):
- Line ~37: dockerInnerCommand() — change `--resume ${ref} --fork-session` to `--resume ${ref}`
- Line ~500: getPtyOptionsForCreate() — change `['--resume', resumeRef, '--fork-session']` to `['--resume', resumeRef]`
- Line ~560: getPtyOptionsForRecover() — same change
- Line ~626: getRemoteHostBootstrapCommand() — change `claude --resume ${ref} --fork-session` to `claude --resume ${ref}`

### 2. Fix getPtyOptionsForRecover() sessionRef check:
Currently `canResume = sessionRef !== dbSessionId` fails because sessionRef IS the dbSessionId for new sessions. After fix #3, sessionRef will contain the real Claude ID, so this check will work. But also handle the edge case where sessionRef is still the old Orbit UUID (pre-fix sessions) by NOT passing --resume with an invalid ref.

### 3. Add Claude session ID capture after new session creation:
After creating a new Claude Code session (not terminal/codex/opencode), scan `~/.claude/projects/<key>/` for new .jsonl files to find the real Claude session UUID.

Implementation:
- Import `toClaudeProjectKey` from `@/server/session/claudeHistory` (you'll need to export it)
- Add a private method `captureClaudeSessionRef(sessionId: string, projectPath: string)`:
  1. Wait 3 seconds (setTimeout)
  2. Compute the project key: toClaudeProjectKey(projectPath)
  3. Scan `~/.claude/projects/<key>/` for .jsonl files
  4. Find the newest file (by mtime)
  5. Extract the session ID from the filename (basename without .jsonl)
  6. If different from the current sessionRef, update the DB: `prisma.agentSession.update({ where: { id: sessionId }, data: { sessionRef: claudeSessionId } })`
- Call this method in createSession() after PTY is created, only for claude-code agent type
- Make it fire-and-forget (void promise), don't block session creation

### 4. Export toClaudeProjectKey from claudeHistory.ts:
Change `function toClaudeProjectKey` to `export function toClaudeProjectKey` in src/server/session/claudeHistory.ts

## Reference files:
- src/server/session/sessionManager.ts (main target)
- src/server/session/claudeHistory.ts (export toClaudeProjectKey)
- src/lib/shellQuote.ts (already imported)

## Conventions:
- Read src/server/AGENTS.md for server conventions
- Use TypeScript strict mode
- camelCase for utilities/server code
- Maintain existing code style

## Target Files
- `src/server/session/sessionManager.ts`
- `src/server/session/claudeHistory.ts`

## Dependencies
None

## Acceptance Criteria
- [ ] All 4 --fork-session removed
- [ ] captureClaudeSessionRef method added
- [ ] toClaudeProjectKey exported from claudeHistory.ts
- [ ] getPtyOptionsForRecover uses --resume with valid Claude ref
- [ ] npx tsc --noEmit passes

## Notes
(Orchestrator may add coordination notes here)
