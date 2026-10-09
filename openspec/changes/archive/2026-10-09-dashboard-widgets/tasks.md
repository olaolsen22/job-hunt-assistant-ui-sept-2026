## 1. Design and groundwork

- [x] 1.1 Ask `ui-ux-expert` for the dashboard layout (three groups, widget card, mobile stacking) within the existing visual language
- [x] 1.2 Run `pnpm gql:gen` for `Company.favoritedAt` / `setCompanyFavorite` and commit `app/graphql-env.d.ts`

## 2. Company favorites

- [x] 2.1 Add `favoritedAt` to the `Companies` query and a `companies/FavoriteButton.vue` (optimistic, rollback + toast) using `SetCompanyFavorite`
- [x] 2.2 Place it on `/companies` rows with `@click.prevent.stop` so the row link does not open
- [x] 2.3 Unit test: toggle sets/clears the star and a failed save rolls back (`mountSuspended` + `registerEndpoint`)

## 3. Linking into `/listings`

- [x] 3.1 Seed `filter`, `facets.statuses` and `facets.favorites` in `useListingsList` from `?filter=`, `?status=`, `?favorites=`, ignoring unknown values
- [x] 3.2 Unit test the seeding (preset, statuses lifting the expiry clause, favorites, unknown value ignored)

## 4. Widgets

- [x] 4.1 `DashboardWidget` shell (title, link, loading / empty / error with retry) and `DashboardListingRow`
- [x] 4.2 Date helpers (`daysAgoIso`, `localDayStartIso`); no runtime query builder, since a static `where` with scalar variables passes the cost check
- [x] 4.3 Urgent: Closing soon, Offers to answer, Stale listings (14-45 days old, no expiry clause), Upcoming interviews (INTERVIEWING only; flatten and sort client-side)
- [x] 4.4 Progress: Pipeline counts (seven aliased `totalCount`), Applied this week, To analyze
- [x] 4.5 Shortcuts: Favorited listings, Favorited companies (companies, then one listings query grouped by company)
- [x] 4.6 Replace the placeholder in `app/pages/index.vue` with the widgets; keep `DashboardApiHealth`
- [x] 4.7 Unit tests: query builder (stale clause has the 14-45 day window and no expiry, interviews flattening/ordering), one widget's empty and error states, favorited-companies grouping

## 5. Wrap up

- [x] 5.1 Update `.claude/state/ui-inventory.md` and `docs/REUSABLES.md` for the new components and helper
- [x] 5.2 `pnpm typecheck`, `pnpm lint`, `pnpm test` (E2E not run)
- [x] 5.3 `pnpm build` then `pnpm preview --port 3000`; ask the owner for a live check of the dashboard (cost check on the counts and favorited companies)
- [x] 5.4 Run `/log-progress` to update `docs/STATUS.md`

## 6. Customizable layout

- [x] 6.1 Ask `ui-ux-expert` for the edit mode and the ungrouped grid
- [x] 6.2 `pnpm gql:gen` for `dashboardLayout` / `saveDashboardLayout`; add `constants/dashboard.ts` (registry) and `useDashboardLayout`
- [x] 6.3 Render the saved layout on `/` as one grid (shown widgets only, Pipeline spans the row); loading skeleton, error with retry, centered empty state with "Edit dashboard"
- [x] 6.4 `DashboardEditor`: local copy, up/down (disabled at the ends), show/hide, Reset to default, Save (whole list in order) and Cancel; API and generic errors keep the edits
- [x] 6.5 Tests: saved order and visibility, hidden widget sends no query, save payload, cancel, rejected save, reset then Save / Cancel
- [x] 6.6 Update `docs/REUSABLES.md`, the inventory and `docs/STATUS.md`; `pnpm typecheck`, `pnpm lint`, `pnpm test`
- [x] 6.7 Rebuild, preview, and ask the owner for a live check of edit mode (same pass as 5.3)

## 7. LLM usage widget

- [x] 7.1 `pnpm gql:gen` (new `LLM_USAGE` kind and `llmUsageToday`); add `dashboard/LlmUsage.vue` and its registry entry (last)
- [x] 7.2 Tests: with limit, without limit, and a save that sends ten widgets (the reset test now expects ten)
- [x] 7.3 Update `docs/REUSABLES.md`, the inventory and `docs/STATUS.md`; `pnpm typecheck`, `pnpm lint`, `pnpm test`
- [x] 7.4 Rebuild, preview, and ask the owner for a live check (same pass as 5.3 and 6.7)
