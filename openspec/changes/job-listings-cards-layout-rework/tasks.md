# Tasks

## 1. Card layout

- [x] 1.1 Ask `ui-ux-designer` to review the `md`+ card (two columns, "View posting" in the title row) and the pager spacing; verify by a short written layout recommendation
- [x] 1.2 Rework `app/components/listings/Card.vue`: two-column body (company + location | `ListingsDates`) and "View posting" in the title row from `md` up, phone layout unchanged; verify at 768px, 1024px and 390px widths with a screenshot (ask the owner first)
- [x] 1.3 Extend the existing Card/Dates unit coverage only if layout logic was added; verify with `pnpm vitest run test/unit/Dates.test.ts`

## 2. Page size

- [x] 2.1 In `app/pages/listings/index.vue` render an always-present grid wrapper (template ref) in loading, empty and list states, and size skeletons to `CARD_HEIGHT` and the computed page size; verify the loading state shows the same number of placeholders as cards
- [x] 2.2 In `app/composables/useListingsList.ts` replace `getPageSize()` with the measured computation (height, column count, clamp, phones = 5), `immediate: false`, and `execute()` on mount; verify a single `/graphql` request on load with the expected `take`
- [x] 2.3 Check the backend's maximum `take` in `../job-hunt-assistant-api-sept-2026/schema.graphql` and set `MAX` accordingly; verify `MAX` is within it
- [x] 2.4 Add a unit test for the page-size computation (mock `innerHeight`, grid top, columns; assert the result for tablet portrait and landscape and phone); verify with `pnpm vitest run test/unit/useListingsList.test.ts`
- [x] 2.5 Update `docs/REUSABLES.md` for the composable change; verify the entry matches the code

## 3. Verification

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint` and `pnpm test`, fixing any e2e mocks that assumed the old page sizes
- [ ] 3.2 Confirm on the Galaxy Tab S9 (owner): 4 cards and visible pagination in landscape and portrait at 100% zoom
- [x] 3.3 Run `/log-progress` to update `docs/STATUS.md`
