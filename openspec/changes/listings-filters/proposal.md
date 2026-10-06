# Proposal

## Why

The `/listings` page can only be narrowed with four one-click presets (closing soon, to analyze, active, archived) and a text search. There is no way to see only favorites, to filter by application status, skill, location or language, or to change the order. The API's `ListingFilterInput` and `ListingSortInput` already support all of this.

## What Changes

- New **facets**, combinable with each other, with one preset, and with search (all AND):
  - Favorites only (toggle)
  - Status (multi-select, any of SAVED … WITHDRAWN)
  - Skill (multi-select combobox, any of)
  - Location (multi-select combobox, any of)
  - Posting language (multi-select; the language the ad is written in)
  - Required language (multi-select; languages the job asks for)
- New **sort** dropdown: "Due date" (default, sends no `order`), "Newest added" (`createdAt DESC`), "Recently changed" (`statusChangedAt DESC`).
- Facets live in a collapsible filter panel, collapsed by default on mobile.
- The listings query is built at runtime: its `where` is literal text made from the active preset and only the selected facets, with the values as variables (`$statuses`, `$skills`, `$locationIds`, `$postingLanguages`, `$languages`, `$today`). A `ListingFilterInput` variable fails the API cost check (HC0047), and a null, omitted or empty `in` can't mean "no filter".
- **BREAKING (UI):** the "active" preset is removed; the Status facet replaces it. The remaining presets (closing soon, to analyze, archived) stay, still mutually exclusive with each other, and now combine with the facets.
- Preset counts respect the active facets and search.

Out of scope:

- Explicit or descending due-date sort: `dueOn` is computed server-side and is not sortable.
- "Has all of" matching for skills, locations or languages (any-of only).
- Company, seniority, work mode, employment type, schedule, date-range and interview filters.
- Persisting filters in the URL or across sessions.
- Any API change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-browsing`: adds the facet filters, the sort dropdown and the collapsible filter panel; changes the preset requirement (the "active" preset is gone, presets combine with facets, counts respect facets).

## Impact

- `app/composables/useListingsList.ts`: the five literal preset queries are replaced by one runtime-built query (preset and facet clauses, `$order`); facet state, the query builder, and counts that include the facets.
- `app/pages/listings/index.vue`: sort dropdown, filter panel toggle, "active" preset button removed.
- New components under `app/components/listings/` for the filter panel and the multi-select comboboxes (skill, location).
- New GraphQL lookup for locations returning `id`, `city`, `countryCode` (the existing `CitySearch` needs a country and returns only the city name).
- Cost check (answered): the API rejects a `ListingFilterInput` variable at any value (HC0047). The query is built from fixed clause strings, following the `batchDocument` precedent in `app/utils/graphql.ts` (see design.md).
- `docs/STATUS.md`, `docs/REUSABLES.md`, `test/e2e/*` that click the "active" preset.
