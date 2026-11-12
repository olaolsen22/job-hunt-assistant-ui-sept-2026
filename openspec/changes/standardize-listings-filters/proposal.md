## Why

The `/listings` toolbar spreads one job across four rows of different control types: preset tabs, a sort select, search with Favorites and Filters buttons, and six always-visible yes/no pills. Nothing says which control is a view, which narrows the list and which orders it, and related filters are split (the Norway and Preferred pills sit apart from the Location field; the English posting pill duplicates the Posting language field). The owner keeps hunting for the control they want.

## What Changes

One rule, the same at every width: **view** (tabs / select) → **narrow** (search, two inline toggles, Filters) → **order** (sort) → **active state** (chips, then Clear all).

- Remove the six-pill row. Its toggles move into the Filters sheet, which gets headed groups: Status, Location, Role, Language, Skills, Dates. Each toggle keeps its count.
- **Favorites** and **Preferred locations** stay inline in the search row as the only two toggles, next to a Filters button with an active-count badge (assumed to be the most-used; easy to swap).
- IT roles / Non-IT roles become one three-way **Role** control (Any / IT / Non-IT); the two facets stay mutually exclusive.
- Sheet toggles that used to show their state in the toolbar (Norway only, Role, English posting, English mentioned) now appear as chips, so nothing active is hidden.
- Desktop and tablet: heading row, view row (tabs + More left, Sort right), search row (search, Favorites, Preferred locations, Filters with visible labels from `md`), chips. Tablet tabs scroll rather than collide with Sort.
- Phone: header with Add listing / Quick add, then View and Sort selects side by side, full-width search, one row of Favorites / Preferred locations / Filters (icon + short label, touch height), chips. Filters opens as the existing bottom sheet.
- Query, URL parameters and facet model are unchanged, so existing deep links keep working.

Out of scope: API/GraphQL changes, new filters, merging English posting into Posting language (needs a facet/URL change), moving "Incl. expired"/"Archived" (they are mutually exclusive presets in the query, not facets), the Companies page layout (it keeps using the shared sheet and chips unchanged).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-browsing`: toolbar layout and where the quick toggles live.

## Impact

- `app/components/listings/FilterPanel.vue` (toolbar, grouped sheet, chips), `app/pages/listings/index.vue` (view row and phone layout).
- `test/unit/FilterPanel.test.ts` and listing-page tests that look for `listings-facet-*` pills; `test/e2e/listings-search.spec.ts` (updated, not run).
- `docs/REUSABLES.md` entry for `ListingsFilterPanel`.
- No shared component change expected: `AppFilterSheet` and `AppFilterChips` stay as they are.
