# Proposal

## Why

Opening a listing from `/listings` and coming back resets the search, sort, preset, facets and page,
so the user has to rebuild the view. `/companies` has the same problem with its search and page.

## What Changes

- `/listings` keeps its whole view in the URL query: search, sort, preset, every facet and the page.
  Changing any of them updates the URL in place (replace, not a new history entry). Opening the URL
  restores that exact view.
- The existing dashboard links (`?filter=`, `?status=`, `?favorites=1`) and the companies link
  (`?search=`) keep working unchanged.
- The listing page's "Back" button returns to the last listings view (with its query), not the bare
  `/listings`, so it works after visiting the edit page too.
- `/companies` keeps its search and page in the URL the same way.

Chosen over a Pinia store: the URL survives refresh and browser back/forward, can be bookmarked,
already carries the dashboard's filters, and needs no store for state that belongs to one page.

### Out of scope

- Scroll position (lists are paged to fit the screen from `md` up).
- Whether the facet panel is open (it stays closed by default).
- Keeping the same page boundaries across devices: page size is still measured per load, so a URL
  opened on another screen size may show a different slice for the same page number.
- Sidebar "Job listings" link and post-add redirect still open the default list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-browsing`: "Starting state from the URL" grows to cover every control and the page, and
  the view is written back to the URL; the listing page's Back returns to that view.
- `company-management`: the companies list keeps search and page in the URL.

## Impact

- `app/composables/useListingsList.ts` (parse and write the query), `app/pages/listings/index.vue`
- `app/pages/listings/[id]/index.vue` (Back link)
- `app/pages/companies/index.vue`
- Unit tests for the query round-trip and the companies URL state. No API changes.
