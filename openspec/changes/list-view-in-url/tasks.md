# Tasks

## 1. Listings view in the URL

- [x] 1.1 Extend `parseListingsQuery` to return search, sort, preset, all facets and page (unknown values dropped), and add its inverse `toListingsQuery` that omits defaults; verify with a round-trip unit test in `test/unit/listingsQuery.test.ts` (full state, defaults → empty query, junk values ignored, existing dashboard links still parse)
- [x] 1.2 In `useListingsList`, seed all state from the parsed query and `router.replace` the serialized state on change (from `settledSearch`, not raw `search`); verify `pnpm vitest run test/unit/FilterPanel.test.ts` and the new test pass, and the URL updates without new history entries
- [x] 1.3 Store the current listings `fullPath` in `useState('listingsView')` and point the listing page's Back at it (fallback `/listings`); verify Back returns to the filtered page after an edit + save

## 2. Companies view in the URL

- [x] 2.1 Seed `search`/`settledSearch`/`page` from the query in `pages/companies/index.vue`, `router.replace` them on change, and open on `?page=N` through `goTo(N)` after measuring; verify with a case in `test/unit/CompaniesList.test.ts` that `?page=2` requests page 2 with page 1's end cursor
- [x] 2.2 Make `goTo` stop at the last page when `hasNextPage` is false; verify a page past the end shows the last page in the same test file

## 3. Checks

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; all pass (E2E not run)
- [x] 3.2 Update `.claude/state/ui-inventory.md` for `toListingsQuery`, then run `/log-progress`
