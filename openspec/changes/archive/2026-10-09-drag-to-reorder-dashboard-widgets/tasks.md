# Tasks

## 1. Draggable editor rows

- [x] 1.1 Add `vue-draggable-plus` (`pnpm add vue-draggable-plus`); verify it is in `package.json` and `pnpm typecheck` still passes
- [x] 1.2 In `Editor.vue`, bind the row list to `draft` with the draggable component (`handle` on a grip button with `i-lucide-grip-vertical`, `ghost-class` placeholder, disabled while `saving`) and remove `move()` and the up/down buttons; verify in the preview that rows drag only by the handle and the order is kept through Save (ask the owner before any live check, else report the UI as unverified)
- [x] 1.3 Rewrite the `DashboardLayout.test.ts` cases that click `dashboard-editor-up/down` (save order, cancel, rejected save) to reorder through the draggable's `v-model` update; verify with `pnpm vitest run test/unit/DashboardLayout.test.ts`

## 2. Wrap up

- [x] 2.1 Update `.claude/state/ui-inventory.md` and `docs/STATUS.md` for the drag-based editor (run `/log-progress`)
- [x] 2.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; all pass (E2E not run)
