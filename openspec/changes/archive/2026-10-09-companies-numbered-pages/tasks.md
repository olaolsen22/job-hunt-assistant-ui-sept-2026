# Tasks

## 1. Numbered pager

- [x] 1.1 Page-size cap: `schema.graphql` gives `@listSize(assumedSize: 50)` for `companies`, so `first` ≤ 50 and the design pages by cursor (design.md). Verify: design.md cites the cap.
- [x] 1.2 In `app/pages/companies/index.vue` replace the Prev / Next trail with a `page` ref and a per-page `cursors` array (design.md, decisions 1 and 2), reset both on a new search, and swap Prev / Next for `UPagination` as in `app/pages/listings/index.vue`. Verify: `pnpm typecheck` and `pnpm lint`; in the browser (owner runs the dev server) next page, a jump to a later page, and back to page 1 show the right rows, and a search returns to page 1.
- [x] 1.3 Update `test/unit/CompaniesList.test.ts` to the new pager: clicking page 2 asks for the first page's `endCursor` as `after`. Verify: `pnpm vitest run test/unit/CompaniesList.test.ts`.
- [x] 1.4 Update the companies page entry in `docs/STATUS.md` and run `/log-progress`. Verify: it says numbered pages. Then `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## 2. Page size

- [x] 2.1 Size the page like `/listings` (`measurePageSize` with row height and gap, runtime literal `first`, first fetch on mount) and show `pageSize` skeletons. Verify: browser at 390 / 900 / 1280 / 1440 / 1920 px shows 5 / 3 / 6 / 8 / 12 rows with no API errors; `pnpm test` passes.
