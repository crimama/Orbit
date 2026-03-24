# Task: Fix globals.css text-xs override

## Agent
agent-03

## Status
pending

## Description
Remove the text-xs override in src/app/globals.css that inflates all toolbar heights.

Current code (lines 96-99):
```css
.text-xs {
  font-size: 0.875rem;
  line-height: 1.35;
}
```

This overrides Tailwind's standard `text-xs` (0.75rem / 1rem) with 0.875rem, making all `text-xs` elements larger than expected. This directly inflates the height of:
- Top navigation bar
- Tab bars in BorderlessWorkspace
- Pane toolbars in TerminalPane
- Session list items
- All other text-xs elements

Action: DELETE the entire .text-xs block (lines 96-99) from the @layer utilities section. Keep the .text-balance utility.

The result should be:
```css
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

This is a safe change because Tailwind's default text-xs (0.75rem) is the standard expected value.

## Target Files
- `src/app/globals.css`

## Dependencies
None

## Acceptance Criteria
- [ ] text-xs override removed
- [ ] text-balance utility preserved
- [ ] File still valid CSS

## Notes
(Orchestrator may add coordination notes here)
