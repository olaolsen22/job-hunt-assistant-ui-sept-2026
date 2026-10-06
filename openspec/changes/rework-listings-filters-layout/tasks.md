# Tasks

## 1. Layout

- [x] 1.1 Rework `FilterPanel.vue`: toolbar row (`v-model:search` input with the existing clear button, sort, Filters toggle with count badge, Clear all when active), then a facet grid (`sm:grid-cols-2 lg:grid-cols-3`) in order Status, Skill, Location, Posting language, Required language, Favorites. Panel closed by default on all sizes, toggled with a class swap/`v-if` (no new component); toggle visible at every width. Keep all existing `data-testid`s. Verify: `pnpm typecheck`.
- [x] 1.2 In `app/pages/listings/index.vue`, remove the standalone search input and pass `v-model:search` to the panel; keep the existing `v-if` that hides the toolbar when there are no listings and nothing is narrowed (but keep search visible while loading). Verify: search, sort, facets and clear all still work; empty filtered state still shows the toolbar.
- [x] 1.3 Phone layout: search on its own row, sort and Filters side by side below it. Verify: screenshot at phone and desktop widths (ask first) or report as unverified.

## 2. Tests and docs

- [x] 2.1 Update `test/e2e/listings-search.spec.ts` to click `listings-filters-toggle` before `listings-facet-status`. Verify: the owner runs `pnpm test:e2e`; E2E not run by me.
- [x] 2.2 Add one unit test (`mountSuspended`): panel is closed by default, the toggle opens it, and the count badge shows active facets. Verify: `pnpm vitest run test/unit/<Name>.test.ts`.
- [x] 2.3 Update `docs/REUSABLES.md` (panel props now include search) and `.claude/state/ui-inventory.md`; run `/log-progress` for `docs/STATUS.md`.
- [x] 2.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`. Verify: all pass.
