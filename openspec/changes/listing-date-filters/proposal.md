# Proposal

## Why

The listings page can't narrow by time. The owner wants to see listings posted in a date range, and listings due soon, including ones with no real deadline.

## What Changes

- Add a **Posted** filter: optional From and To dates on the posted date.
- Add a **Due within** filter: a select (Any, 3, 7, 14, 30 days) on the server's due date, so ASAP and Not stated listings count too. Expired listings are excluded.
- Both live in the URL, count in the active-filter badge, and reset with Clear all.

Out of scope: arbitrary due ranges (the API can't filter on `dueOn`), posted presets, "days since posted", a "no deadline" checkbox.

## Capabilities

### New Capabilities

### Modified Capabilities

- `listing-browsing`: the facet list gains Posted and Due within.

## Impact

- `app/composables/useListingsList.ts`, `app/components/listings/FilterPanel.vue`, `test/unit/buildListingsQuery.test.ts`, `test/unit/listingsQuery.test.ts`, `docs/STATUS.md`. No API or schema change.
