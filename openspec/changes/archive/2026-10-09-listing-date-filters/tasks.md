# Tasks

## 1. Query and URL state

- [x] 1.1 Add `postedFrom`, `postedTo` and `dueWithinDays` to `ListingsFacets` / `emptyFacets`; count From+To as one in `countActiveFacets`; verify with a unit test
- [x] 1.2 Parse and serialize them in the URL (`postedFrom`, `postedTo`, `due`), dropping unknown values; verify with a round-trip test in `listingsQuery.test.ts`
- [x] 1.3 In `buildListingsQuery`, add the `postedOn` clause and the `dueWithinDays` argument on every `listings` field (`min(7, N)` with closing soon); verify with `buildListingsQuery.test.ts` cases for each

## 2. Filter panel

- [x] 2.1 Add the From/To inputs and the "Due within" select to `FilterPanel.vue`; verify with a `mountSuspended` test that setting them updates the facets
- [x] 2.2 Update `docs/STATUS.md` and `.claude/state/ui-inventory.md`; run `pnpm typecheck`, `pnpm lint`, the listings tests, then `pnpm build` and `pnpm preview --port 3000`
