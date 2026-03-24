# Task: BorderlessWorkspace + TerminalPane border cleanup

## Agent
agent-02

## Status
pending

## Description
Remove redundant decorative layers in BorderlessWorkspace and TerminalPane. Files: src/components/dashboard/BorderlessWorkspace.tsx and src/components/terminal/TerminalPane.tsx.

Changes to BorderlessWorkspace.tsx:
1. OUTER WRAPPER (line ~458): Remove redundant border and rounded corners:
   - Change `rounded-xl border border-neutral-800 bg-neutral-950` to `bg-neutral-950`
   - The inner panel sections already have their own borders, so the outer one is decorative waste

2. PANEL SECTION BORDERS (line ~465-469): Simplify the active panel indicator:
   - Keep the cyan shadow for active panel but remove the 1px border when inactive
   - Change inactive class from `border-neutral-800` to `border-transparent`
   
3. TAB BAR (line ~387): Make slightly more compact:
   - Change `px-2 py-1` to `px-1.5 py-0.5`

Changes to TerminalPane.tsx:
4. OUTER WRAPPER (line ~172): Reduce corner radius:
   - Change `rounded-2xl` to `rounded-lg`
   - This reduces corner clipping from 16px to 8px

5. DROP INDICATOR (line ~232): Match the new radius:
   - Change `rounded-xl` to `rounded-md` in the drop zone indicator

Read src/components/AGENTS.md for conventions. Preserve all drag-drop, focus, and keyboard functionality.

## Target Files
- `src/components/dashboard/BorderlessWorkspace.tsx`
- `src/components/terminal/TerminalPane.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] No rounded-xl border on BorderlessWorkspace outer div
- [ ] TerminalPane uses rounded-lg
- [ ] Tab bar uses py-0.5
- [ ] npx tsc --noEmit passes

## Notes
(Orchestrator may add coordination notes here)
