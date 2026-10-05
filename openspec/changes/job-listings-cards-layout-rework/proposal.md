## Why

On a tablet (Galaxy Tab S9) the `/listings` page shows only 4 cards at 80% browser zoom, and the pagination is below the fold. Cards stack every field in one column, so they are taller than they need to be, and the page size is a few hardcoded steps rather than a fit to the screen.

## What Changes

- `ListingsCard` gets a two-column body from `md` (768px) up: column 1 = company and location, column 2 = dates (posted, deadline). The title row and badges stay full width above them. Below `md` (phones) the card layout is unchanged.
- "View posting" moves out of the body into the title row, pushed to the far end (`justify-between`) next to the favorite button, from `md` up. On phones it keeps its current place at the bottom of the card.
- Page size is computed from the available viewport height and the real grid column count when the page loads, replacing the hardcoded 5/6/8/10 steps in `getPageSize()`. The goal: all cards and the pagination are visible without scrolling at 100% zoom. Target on the Galaxy Tab S9 is 4 cards in both landscape (2 columns x 2 rows) and portrait (1 column x 4 rows).
- The first fetch waits for the measurement (`immediate: false`, then `execute()` on mount), so there is still exactly one request on load.

Out of scope:

- Phone (< `md`) card layout and page size. Phones keep 5 per page.
- Resize/rotation reactivity. The page size is still decided once per page load, so page boundaries don't shift under the user.
- The detail page's use of `ListingsDates` (`detail` mode).
- Any API or GraphQL change.

## Capabilities

### New Capabilities

- `listings-list-layout`: how the `/listings` card grid lays out its cards and chooses its page size across phone, tablet and desktop.

### Modified Capabilities

None. There are no existing specs in `openspec/specs/`.

## Impact

- `app/components/listings/Card.vue`: two-column body, "View posting" in the title row at `md`+.
- `app/components/listings/Dates.vue`: possibly none (the compact variant is already a block of two lines); confirm during implementation.
- `app/composables/useListingsList.ts`: `getPageSize()` replaced by a measured computation; `useAsyncData` starts with `immediate: false`.
- `app/pages/listings/index.vue`: an always-rendered anchor element for the grid so it can be measured before data arrives; skeleton height aligned with the card.
- `docs/REUSABLES.md` / `docs/STATUS.md`: updated if the composable's contract changes.
- Tests: `test/e2e/*` that rely on listings-per-page may need their mocked data counts checked.
- Still to check at implementation: the backend's maximum `take` for the page-size cap.
