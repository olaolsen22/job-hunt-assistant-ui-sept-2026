# Design

## Context

- `ListingsCard` stacks title, badges, company, location, `ListingsDates` and the "View posting" button in one column (`app/components/listings/Card.vue`).
- `getPageSize()` in `app/composables/useListingsList.ts` returns 5 below 1024px and 6/8/10 above it by `innerHeight` bands. It is called once per page load on purpose (resizing must not shift page boundaries).
- The page grid is 1 column below `lg` and 2 columns from `lg` (`app/pages/listings/index.vue`). The list scrolls inside `UDashboardPanel`'s body, so the viewport height minus the grid's top offset is what the cards and pager share.
- `useAsyncData('listings', ..., { server: false })` fetches immediately in setup, before any DOM exists.

## Goals / Non-Goals

**Goals:**

- Two-column card body and relocated "View posting" from `md` up, phones unchanged.
- Page size derived from real available height and real column count.

**Non-Goals:**

- Reacting to resize or rotation after load.
- A pinned/sticky pagination bar or an inner scroll area.

## Decisions

1. **Card layout with Tailwind only.** A `md:grid md:grid-cols-2` wrapper around the company/location block and `ListingsDates`. The "View posting" button is rendered once and positioned with classes (title row `flex` + `md:justify-between`; the button is `order`/`hidden` switched per breakpoint) or rendered twice with `md:hidden` / `hidden md:inline-flex`. Prefer the two-render option only if one-element positioning needs an arbitrary value; the simplest that works wins. Alternative: a JS breakpoint check (`useBreakpoints`), rejected: CSS does this for free and avoids hydration mismatch.

2. **Page size = floor(available / (CARD_HEIGHT + gap)) x columns.**
   - `available = window.innerHeight - grid.getBoundingClientRect().top - PAGER_HEIGHT - bottom padding`.
   - `columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length`, so changing the grid classes never needs a change here.
   - `CARD_HEIGHT` is a constant tied to the skeleton height and set slightly high. Overestimating costs at most one row; underestimating pushes the pager below the fold, which is the failure this change exists to prevent. Alternative: render and measure a real card, then refetch. Rejected: extra request and a visible jump.
   - Clamp to `[2 x columns, MAX]`. `MAX` is capped by the backend's allowed `take` (verify in `schema.graphql` during implementation).
   - Below `md` return 5 (phones unchanged).

3. **Measure before fetching, still one request.** `useAsyncData` gets `immediate: false`; the composable measures in `onMounted` and then calls `execute()`. The grid anchor must exist before data does, so `index.vue` renders a grid wrapper in every state (loading, empty, list) and the composable takes a template ref to it. In Vue 2 terms: measure in `mounted()`, then start the fetch you would have put in `created()`.

4. **Skeleton matches the card.** The `h-28` skeletons are replaced by a height equal to `CARD_HEIGHT`, and their count equals the computed page size, so the loading state doesn't jump.

## Risks / Trade-offs

- [Wrapped title or badges make a card taller than `CARD_HEIGHT`] → pessimistic constant; the page may scroll a little, pager stays reachable.
- [Page size is stale after rotating the tablet] → accepted; documented in the proposal, refresh recomputes.
- [Empty state / error state have no grid to measure] → measure the wrapper, which is always rendered; if the first fetch errors the page is unaffected.
- [`immediate: false` leaves `status` as `idle` before mount] → the loading skeletons key off `loading` (`pending`); show them while idle too, or the page flashes the empty state.
- [Existing e2e tests assume the old page sizes] → check mocked list lengths when running the suite.
