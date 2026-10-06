# Design

## Context

See proposal.md for motivation. Quick-add listings (`app/pages/listings/quick-add.vue`) already does paste → rows → validate → save → result cards, and `useParsePrompt` already wraps the copy-paste prompt and the built-in `parseListing` call, keyed by prompt name. `ListingsNameCombobox` (type or pick, create-on-save) and `ListingsLocationsField` (country + city repeater) already exist. The `companies` query is a cursor connection (`first/after`, `last/before`, `pageInfo`, `totalCount`); `createCompanies` takes 1–100 rows and is all-or-nothing, and its errors carry a message but no row index.

## Goals / Non-Goals

**Goals:** reuse what quick-add and the listing form already have; keep the add page's shape recognisable next to quick-add.

**Non-Goals:** extracting a shared "batch paste" component from quick-add. That page is 650 lines of listing-specific code; two uses of the idea do not justify an abstraction yet, and CLAUDE.md says to copy until the shapes settle.

## Decisions

1. **Companies page copies quick-add's structure, not its code.** Paste card, summary line with "Paste more", row cards, result cards, save bar. Row helpers (`toRow`, `isBlank`, `validate`) are written for company rows in the page. Alternative: factor a shared component. Rejected for now (see Non-Goals).
2. **One `createCompanies` call, one error banner.** Quick-add sends one aliased mutation per row, so each row can fail alone. Here the API is a single all-or-nothing call and errors have no row index, so the banner shows the messages once and the rows stay as they were. Client-side validation is therefore stricter than in quick-add: name required, each location has a valid country code (the country select makes this nearly automatic).
3. **Existing companies are reported after saving** (`results[].created === false`), as quick-add reports duplicates after saving. No pre-check query against `companies(search)`.
4. **Paging is Prev / Next on the cursor.** Keep the `endCursor` of each page in an array; Next pushes the current page's `endCursor`, Previous pops it. Only `first` and `after` are used, never `last/before`, so one query shape covers both directions. Search and any change reset the trail. Alternative: Load more (append). Chosen less because the list is read-and-scan and Prev / Next matches `/listings`.
5. **`useParsePrompt` gets a third prompt name** (`companyParsePrompt`, mode `COMPANIES`) in its two lookup tables. Alternative: a separate composable. Rejected: the copy/parse logic is identical.
6. **Industry reuses `NameCombobox`** through a fourth lookup (`industries`) in its `QUERIES` and in `NameLookup`. Alternative: a plain text input. Rejected: the owner wants the same type-or-pick behaviour as company and role.
7. **Components stay where they are.** The companies pages import `<ListingsNameCombobox>` and `<ListingsLocationsField>`. Renaming or moving them to `app/` is a refactor of its own.
8. **The list row links to `/listings?search=<name>`.** `useListingsList` seeds `search` from the route query on load. The search is a contains-match, so it can also show other companies with a similar name; accepted, since listings has no company filter.
9. **Cache.** After a successful save, `clearNuxtState('name-lookups')` as quick-add does, so new companies and industries show in dropdowns.

## Risks / Trade-offs

- A single bad row (for example a country code the AI invented) blocks the whole batch → the country is a select, not text, and parsed locations with an unknown country code are dropped like quick-add does, so the server error should be rare.
- `LocationsField` hides its remove button when only one location is left, so a row that has a location cannot go back to none → accepted; the row can be removed, or the location left as country-only. If it bothers, a small prop on the field is a separate change.
- A parsed row with no locations has an empty repeater that only shows "Add location" → fine, `[]` is a valid input.
- `useListingsList.ts` is mid-change in `listings-filters` → land that first.

## Open Questions

- Industry filter on the list can be added later without touching the specs above beyond one requirement.
