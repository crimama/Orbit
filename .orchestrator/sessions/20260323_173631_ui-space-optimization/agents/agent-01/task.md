# Task: Dashboard layout compression

## Agent
agent-01

## Status
pending

## Description
Compress the Dashboard layout to maximize terminal pane area. Changes to src/components/dashboard/Dashboard.tsx ONLY:

1. TOP NAV BAR (line ~792): Compress from ~45px to ~28px:
   - Change `py-2` to `py-1` in the nav bar className
   - Change all `h-7` buttons to `h-6` in the nav bar section
   - Change `w-7` buttons to `w-6` in the nav bar section

2. CONTENT WRAPPER PADDING (line ~1306): Remove the padding that creates 12px gap around workspace:
   - Change `p-2 sm:p-3` to `p-0` in the className of the div wrapping BorderlessWorkspace
   - Also update the empty state placeholder div on line ~1308 to keep some padding there: keep `p-6` on that specific empty state div

3. SIDEBAR FULL HIDE MODE: Currently collapsed sidebar is 80px minimum. Add a fully hidden (0px) state:
   - The collapse button toggles `isProjectsListCollapsed`. Change the width logic (line ~895):
     Current: `width: isProjectsListCollapsed ? '5rem' : leftPanelWidth + 'px'`
     New: `width: isProjectsListCollapsed ? '0px' : leftPanelWidth + 'px'`
   - Add `overflow-hidden` to the left panel div when collapsed
   - Hide the resize divider when collapsed (already done at line ~1275)
   - The expand button still needs to be visible. Move it: when collapsed, render a small floating expand button at the left edge of the RIGHT panel instead. Add a 24px wide absolute-positioned button with the ▶ icon at the left edge of the layout split container.

4. LEFT PANEL BORDER: When collapsed to 0px, remove the right border:
   - Add conditional: collapsed ? 'md:border-r-0' : 'md:border-r' 

Read src/components/AGENTS.md for conventions. Preserve all existing functionality.

## Target Files
- `src/components/dashboard/Dashboard.tsx`

## Dependencies
None

## Acceptance Criteria
- [ ] Nav bar height reduced to ~28px
- [ ] Content wrapper padding is p-0
- [ ] Sidebar collapses to 0px width
- [ ] Floating expand button visible when sidebar hidden
- [ ] npx tsc --noEmit passes

## Notes
(Orchestrator may add coordination notes here)
