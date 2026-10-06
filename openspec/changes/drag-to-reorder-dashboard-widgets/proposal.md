# Proposal

## Why

Reordering widgets in the dashboard editor means pressing the up/down buttons once per step, which is slow when a widget has to travel several places. Dragging is the natural way to reorder a list.

## What Changes

- Editor rows become draggable (via `vue-draggable-plus`), from a grip handle at the start of the row only, so the switch and touch scrolling are not affected.
- The dragged row leaves a ghost placeholder showing where it will land.
- The up/down buttons and `move()` are removed. Keyboard reordering is dropped (owner decision; no dedicated a11y work).
- Show/hide, Reset to default, Save and Cancel behave exactly as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-overview`: the "Editing the dashboard" requirement changes from move up/down controls to drag-to-reorder.

## Impact

- `app/components/dashboard/Editor.vue` (template + removal of `move`)
- `package.json` / lockfile: add `vue-draggable-plus`
- `test/unit/DashboardLayout.test.ts`: tests that click the up/down buttons are rewritten
- `.claude/state/ui-inventory.md`, `docs/STATUS.md`: update the editor description

Out of scope: any change to the saved layout shape, the API, the dashboard grid itself, or keyboard-accessible reordering.
