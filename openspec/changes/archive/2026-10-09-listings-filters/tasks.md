# Tasks

## 1. Query and state

- [x] 1.1 In `useListingsList.ts`, add and export `buildListingsQuery(preset, facets)` (design.md, decisions 1–5) and a unit test in `test/unit/`: no facets → no facet clauses and no unused variables; a status selection drops the expiry clause; two facets → two clauses under `and`. Verify: `pnpm vitest run test/unit/buildListingsQuery.test.ts`.
- [x] 1.2 Switch the composable to `buildListingsQuery` with `$order` (omitted for "Due date"), and remove the five literal queries and the "active" preset and count. Verify: `pnpm typecheck`, and the page loads with a facet applied with no API error, and lists, searches, pages and shows preset counts as before.
- [x] 1.3 Add reactive `facets` and `sort` to the composable, reset `page` on any change, and expose them. Verify: changing a facet in the Vue devtools refetches page 1.
- [x] 1.4 Add the `Locations` lookup (`id city countryCode`, no country restriction). Verify: `pnpm typecheck`.

## 2. UI

- [x] 2.1 Consult the `ui-ux-designer` agent for the filter panel layout: facet controls, sort dropdown, collapsed-by-default on phones with an active-count toggle, clear-all, empty state, and desktop behavior (design.md, open question). Verify: the agreed layout is written down before building.
- [x] 2.2 Build `ListingsFilterCombobox` (multi, debounced lookup, no create option) for skills and locations. Verify: a unit test that selecting two items emits both.
- [x] 2.3 Build the filter panel with the six facets and the sort dropdown, wired to the composable, in `app/pages/listings/index.vue`. Reuse existing status and language labels. Verify: each facet narrows the list, combines with presets and search, "clear" resets all facets, and all six facets at once return no API error.
- [x] 2.4 Collapse the panel by default below `md`, with the toggle showing the active-facet count. Keep clear-all and the panel reachable in the empty state. Verify: screenshot at phone and tablet widths (ask first) or report it as unverified.

## 3. Wrap-up

- [x] 3.1 Update `test/e2e/` specs that click `listings-filter-active`, and add one e2e for a key flow (select a status, see the filtered list). Verify: `pnpm test:e2e` passes (the owner runs it).
- [x] 3.2 Update `docs/REUSABLES.md` (new combobox, panel, composable contract) and run `/log-progress` for `docs/STATUS.md`. Verify: both list the new pieces and the removed "active" preset.
- [x] 3.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`. Verify: all pass.
