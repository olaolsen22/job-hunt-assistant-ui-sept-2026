# Tasks

## 1. Regenerate types and fix the breaking enums

- [x] 1.1 Run `pnpm gql:gen` and verify `app/graphql-env.d.ts` has `ACCEPTED`, `dueOn`, `previousAttempts`, `search`/`dueWithinDays`, and no `ROLLING`
- [x] 1.2 Remove `ROLLING` from `DEADLINE_TYPE_OPTIONS` and add `ACCEPTED` to `APPLICATION_STATUS_OPTIONS` and `OUTCOME_OPTIONS` in `app/constants/listing.ts` (temporary color `success`, final color from task 2.1); verify `pnpm typecheck` reports no errors from the constants
- [x] 1.3 Map a parsed `deadlineType: 'ROLLING'` to `'ASAP'` in `useListingForm`'s `fillDraft` and `quick-add.vue`'s draft mapping; add one case to `test/unit/useListingForm.test.ts` and verify it passes
- [x] 1.4 Replace `ROLLING` in the e2e mocks (`test/e2e/quick-add.spec.ts`, `test/e2e/apply.spec.ts`) with `ASAP`/`UNSPECIFIED` and add `dueOn` to the listing mocks; verify with `grep -rn ROLLING app test` returning nothing

## 2. Design pass for the new UI bits

- [x] 2.1 Ask the ui-ux-designer agent for the search box and "closing soon" button placement on `/listings`, the previous-attempts note in quick-add and the add-page toast, and Offer vs Accepted badge colors; record its decisions in this change's `design.md`

## 3. Application tracking (ACCEPTED, offer outcomes, undo)

- [x] 3.1 Apply the chosen Offer/Accepted colors in `APPLICATION_STATUS_OPTIONS` and `StatusBadge.vue`; verify an `ACCEPTED` listing renders its badge on card, detail, and timeline (unverified visually unless the owner OKs a screenshot)
- [x] 3.2 In `Application.vue`, return `['ACCEPTED', 'REJECTED', 'WITHDRAWN']` for OFFER, use "Record outcome" as the button label in every status, and pass OFFER-context labels (Accepted / Offer withdrawn / Declined) to `OutcomeModal.vue`; verify via typecheck and by reading the rendered options in a unit test of `OutcomeModal` with OFFER outcomes
- [x] 3.3 Add `... on DuplicateListingError { existingListingId }` to `UndoStatusChange` in `StatusTimeline.vue` and show a toast with a "View open listing" action to `/listings/<id>`; extend `test/unit/StatusTimeline.test.ts` with that error and verify the toast action links to the id

## 4. Server due date in ListingsDates

- [x] 4.1 Add `dueOn` to the `ListingListItem` fragment (`useListingsList.ts`) and the detail query (`useListing.ts`); verify `pnpm typecheck`
- [x] 4.2 Rewrite `Dates.vue` to use `dueOn` (drop `ASAP_DUE_DAYS`/`asapDueDaysLeft`; non-DATE: `<type>, due ~<date>` / `<type>, likely filled`); add `test/unit/Dates.test.ts` covering ASAP due, Not stated due, and expired ASAP, and verify it passes
- [x] 4.3 Update the default-order comment in `useListingsList.ts` (upcoming by due date, then expired, then newest; UNSPECIFIED = posted + 30) and the `ListingsDates` entry in `docs/REUSABLES.md`

## 5. Listings page: search and closing soon

- [x] 5.1 Add `$search: String` to every list query and to each `listings(...)` in `ListingCounts`, plus a debounced (300 ms, `setTimeout` watcher) `search` ref in `useListingsList` that resets `page` to 1 and sends blank as `null`; verify `pnpm typecheck`
- [x] 5.2 Add `LISTINGS_CLOSING_SOON` (`dueWithinDays: 7`) and a `closingSoon` count to `ListingCounts`, register it in `QUERIES`, and add the filter button to `FILTERS` in `listings/index.vue`; verify typecheck and that the button only shows with a non-zero count or while active
- [x] 5.3 Add the search input to `listings/index.vue` per the design from 2.1, keep the toolbar visible while a search or filter is active, and make the empty state say "No listings match" for either; verify with a short e2e case in a new or existing listings spec (mock `listings` by `search` variable) and update the `useListingsList` entry in `docs/REUSABLES.md`

## 6. Previous attempts on add

- [x] 6.1 Request `previousAttempts { id title status }` in `add.vue` and, when present, add the "applied to this before" description and a link action to the success toast; verify by typecheck and reading the toast payload
- [x] 6.2 Add `previousAttempts` to quick-add's `R` fragment and `Row`, and render the per-row note with links and status badges per the design from 2.1; extend `test/e2e/quick-add.spec.ts`'s save mock with one previous attempt and verify the note and link appear

## 7. Verify and log

- [x] 7.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`, and verify all pass (the owner runs `pnpm test:e2e`)
- [x] 7.2 Run `/log-progress` to update `docs/STATUS.md` (currently missing, so this creates it) and verify it lists search, closing soon, ACCEPTED, and previous attempts
