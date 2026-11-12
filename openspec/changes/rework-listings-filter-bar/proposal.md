## Why

The first attempt (`standardize-listings-filters`, applied) buried the quick toggles in the Filters sheet and looked worse: on a 375px phone the Filters button is clipped off the right edge, and on desktop the rows still do not share edges. The owner wants the quick filters back, visible, and a bar that is easy to scan. This change was checked against before screenshots (375/768/1440, mock data) and `ui-ux-expert`.

## What Changes

Three left-aligned rows with one job each, the same order at every width:

1. **View** - preset tabs + More (select on phones) with Sort flush right.
2. **Find** - full-width search, Filters button with active-count badge at the right edge (lines up with Sort).
3. **Quick filters** - seven identical pills: Favorites, Preferred, Norway only, IT roles, Non-IT roles, English posting, English mentioned (counts on all but Favorites). One scrollable line on phones; wrapping from `md`. A quiet "Quick filters" label from `2xl`; idle pills carry no icon so seven fit one line at 1280.

- Favorites and "Preferred locations" leave the search row (fixes the phone clipping); "Preferred locations" is renamed "Preferred".
- The six toggles come back as pills; the sheet's Norway/Role/English switches are removed, since they would duplicate the pills. The sheet keeps Status, Location, Posting/Required language, Skills, Dates under plain headings.
- Chips are only for sheet facets, the company and "Rejected shown"; pill state is shown by the pills themselves. The Filters badge and the sheet's Clear ignore pills; Clear all resets everything.
- Facet model, query and URL parameters stay as they are.

Supersedes `standardize-listings-filters` (do not archive that one; its delta is replaced by this one).

Out of scope: API changes, Companies page, moving presets, new filters.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-browsing`: toolbar layout and where the quick filters live.

## Impact

- `app/components/listings/FilterPanel.vue`, `app/pages/listings/index.vue` (Sort classes).
- `test/unit/FilterPanel.test.ts`, `docs/REUSABLES.md`, `docs/STATUS.md`.
