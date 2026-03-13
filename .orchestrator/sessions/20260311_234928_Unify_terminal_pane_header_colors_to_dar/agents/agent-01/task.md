# Task: Dark theme for TerminalPane header

## Agent
agent-01

## Status
pending

## Description
Convert TerminalPane.tsx from light slate theme to dark neutral theme to match the Dashboard sidebar and nav bar.

CRITICAL COLOR MAPPINGS (apply these exact Tailwind class changes):

1. Outer container (line 177):
   - FROM: border-slate-300 bg-white
   - TO: border-neutral-800 bg-neutral-950

2. Header bar (line 257):
   - FROM: bg-slate-100/90
   - TO: bg-neutral-900
   - borderBottomColor fallback: change '#cbd5e1' to '#404040'

3. Session select dropdown (line 283):
   - FROM: border-slate-300 bg-white text-slate-900 focus:border-sky-400
   - TO: border-neutral-700 bg-neutral-800 text-neutral-100 focus:border-sky-500

4. Project name badge (line 297):
   - FROM: border-slate-300 bg-white text-slate-700
   - TO: border-neutral-700 bg-neutral-800 text-neutral-300

5. Status badge (line 307):
   - FROM: bg-red-50 text-red-600 / bg-emerald-50 text-emerald-700
   - TO: bg-red-900/30 text-red-400 / bg-emerald-900/30 text-emerald-400

6. Workspace area border (line 314):
   - FROM: border-slate-300
   - TO: border-neutral-700

7. Workspace select (line 323):
   - FROM: border-slate-300 bg-white text-slate-700
   - TO: border-neutral-700 bg-neutral-800 text-neutral-300

8. ALL button hover states:
   - FROM: text-slate-500 hover:bg-slate-200 hover:text-slate-900
   - TO: text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200

9. Close button hover:
   - FROM: hover:bg-red-100 hover:text-red-600
   - TO: hover:bg-red-900/30 hover:text-red-400

10. Delete workspace hover:
    - FROM: hover:bg-rose-100 hover:text-rose-600
    - TO: hover:bg-rose-900/30 hover:text-rose-400

11. Kill Session button:
    - FROM: text-slate-500 hover:bg-red-100 hover:text-red-600
    - TO: text-neutral-400 hover:bg-red-900/30 hover:text-red-400

12. Empty pane placeholder (line 450):
    - FROM: bg-slate-100 text-slate-600
    - TO: bg-neutral-950 text-neutral-500

13. Drag handle text (line 378):
    - FROM: text-slate-500
    - TO: text-neutral-500

IMPORTANT: Read the existing AGENTS.md if available. Keep all existing functionality intact. Only change Tailwind CSS classes for theming.

## Target Files
- `src/components/terminal/TerminalPane.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] All slate classes removed
- [ ] Dark neutral theme applied
- [ ] No functional changes
- [ ] tsc passes
- [ ] lint passes

## Notes
(Orchestrator may add coordination notes here)
