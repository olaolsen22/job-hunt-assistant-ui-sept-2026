# Proposal

## Why

The `/listings` page stacks the search box, a four-column grid of six facets plus sort and clear-all, the preset chips, and the add buttons. On desktop the facets are always open, so the top of the page is cramped before any listing shows.

## What Changes

- One toolbar row, on every breakpoint: search (grows), sort, and a **Filters** toggle with an active-facet count. Clear all sits next to the toggle while any facet is active.
- The six facets move into a collapsible panel under the toolbar, closed by default on every breakpoint (today: closed on phones only, always open from `md`).
- Panel layout: Status, Skill, Location on one row; Posting language, Required language, Favorites only on the next.
- Phones: search on its own row, then sort and Filters side by side.
- The search box moves from the page into the filter component; the panel is reworked, not rebuilt.
- Existing `data-testid`s are kept.

Out of scope:

- Active-facet chips in the closed state (needs id-to-label lookups for skills and locations).
- Persisting panel open/closed state or filters.
- Changes to facets, sort options, presets, queries or the API.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-browsing`: "Collapsible filter panel" now applies on all screen sizes and defines the toolbar (search, sort, toggle, clear all).

## Impact

- `app/components/listings/FilterPanel.vue`: toolbar row plus collapsible facet grid; takes the search model.
- `app/pages/listings/index.vue`: search input removed from the page and passed to the panel.
- `test/e2e/listings-search.spec.ts`: facets are now closed by default, so it must open the panel before using `listings-facet-status`.
- `docs/REUSABLES.md`, `docs/STATUS.md`: panel description.
- Consulted: `ui-ux-expert` (layout), `ui-controller` (no existing disclosure pattern; no unit tests reference these ids).
