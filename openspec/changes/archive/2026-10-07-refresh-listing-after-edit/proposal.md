# Proposal

## Why

After editing a listing (for example after "Paste from ad" analysis) and pressing Save changes, the listing page opens with the old values until the browser is refreshed. The saved listing is correct; the page just never re-reads it.

## What Changes

- After a successful save on the edit page, re-read the listing before leaving, so the listing page shows the saved values.
- Cover it with a test that the listing is fetched again after a save.

## Capabilities

### New Capabilities

### Modified Capabilities

- `listing-creation`: a saved edit is reflected on the listing page without a manual refresh.

## Impact

- `app/pages/listings/[id]/edit.vue` (one line after the save succeeds).
- `test/unit/ListingSaveNavigation.test.ts` (or a sibling) for the new behavior.
- No API, schema, or shared composable changes.
