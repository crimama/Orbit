# Task: Session persistence via localStorage

## Agent
agent-02

## Status
pending

## Description
Change MultiTerminal.tsx runtime workspace save/load from sessionStorage to localStorage so pane tree (with sessionIds) survives browser close.

The backend already keeps PTY processes and scrollback alive when browser disconnects. The only gap is the frontend losing its pane tree on browser close because it uses sessionStorage (cleared on close).

EXACT CHANGES NEEDED in src/components/terminal/MultiTerminal.tsx:

1. Line 280-281: Change sessionStorage.getItem to localStorage.getItem
   - FROM: sessionStorage.getItem(`orbit:runtime-workspace:${runtimeStorageKey}`)
   - TO: localStorage.getItem(`orbit:runtime-workspace:${runtimeStorageKey}`)

2. Line 316-318: Change sessionStorage.setItem to localStorage.setItem
   - FROM: sessionStorage.setItem(`orbit:runtime-workspace:${runtimeStorageKey}`, ...)
   - TO: localStorage.setItem(`orbit:runtime-workspace:${runtimeStorageKey}`, ...)

That is the ENTIRE change. Two sessionStorage references become localStorage.

This enables: browser close → reopen → localStorage still has pane tree with sessionIds → panes reconnect → backend sends scrollback → seamless resume.

IMPORTANT: Read the existing AGENTS.md if available. Do NOT change any other logic.

## Target Files
- `src/components/terminal/MultiTerminal.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] sessionStorage replaced with localStorage
- [ ] No other changes
- [ ] tsc passes
- [ ] lint passes

## Notes
(Orchestrator may add coordination notes here)
