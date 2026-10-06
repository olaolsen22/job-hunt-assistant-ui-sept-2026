# Design

## Context

`useListingsList` already reads `filter`, `status`, `favorites` (via `parseListingsQuery`) and
`search` from `useRoute().query` once at setup, but never writes back. `/companies` holds `search`,
`page` and a cursor list in local refs. The listing page's Back is a fixed `to="/listings"`.

## Goals / Non-Goals

**Goals:** one parse and one serialize function per list, so the URL is the single description of
the view; no change to how queries are built or fetched.

**Non-Goals:** a generic "sync any ref to the query" composable (two pages with different state
shapes; not worth the abstraction yet).

## Decisions

**URL query over Pinia or `<NuxtPage keepalive>`.** Pinia would keep the view only in memory (lost
on refresh, not linkable) and CLAUDE.md keeps Pinia for cross-page state. `keepalive` (Vue 2's
`<keep-alive>`) would keep the whole page alive including scroll, but shows stale data on return and
also loses everything on refresh. The URL already carries the dashboard filters, so extending it is
the smallest step.

**Write with `router.replace`, read once on setup.** A `watch` on the settled state calls
`router.replace({ query: toListingsQuery(state) })`. Replace keeps filter tweaks out of history, so
browser back leaves the page. Because `<NuxtPage>` doesn't remount on a query-only change, the page
never re-reads its own writes; returning via back is a fresh mount that reads the query. Search is
written from `settledSearch`, so typing doesn't replace on every keystroke.

**Query format.** Keep the existing keys and comma lists so dashboard and companies links stay valid,
and add the rest:

| Key                                     | Value                     | Default (omitted) |
| --------------------------------------- | ------------------------- | ----------------- |
| `search`                                | text                      | empty             |
| `sort`                                  | `newest` \| `changed`     | `due`             |
| `filter`                                | preset key                | none              |
| `status`, `postingLanguage`, `language` | comma list of enum values | empty             |
| `skill`                                 | comma list of names       | empty             |
| `location`                              | comma list of ids         | empty             |
| `favorites`                             | `1`                       | off               |
| `page`                                  | integer > 1               | 1                 |

`parseListingsQuery` grows to return the full state (validating enums, ids and page);
a new `toListingsQuery` is its inverse. Assumption: skill names don't contain commas.

**Page restore must survive the reset watcher.** The `watch([filter, settledSearch, sort, facets])`
that resets `page` to 1 doesn't fire for initial values, so seeding `page` from the URL is safe.
Restoring the debounced search must also seed `settledSearch` (already done today).

**Companies.** Same pattern with `search` and `page`. Page N needs cursors for pages 1..N-1, so on
mount it calls the existing `goTo(N)` instead of a plain first fetch. `goTo` must stop when
`hasNextPage` is false and clamp to the last page; today it would keep requesting past the end.

**Back button via `useState`.** The listings page stores its current `route.fullPath` in
`useState('listingsView')` whenever it writes the URL (and on mount); the listing page's Back uses
it, falling back to `/listings`. `useState` is Nuxt's SSR-safe shared ref (closest Vue 2 analogue: a
tiny Vuex module), enough for one string. `router.back()` / `history.state.back` was rejected: after
the edit page's save it points to the edit page.

## Risks / Trade-offs

- [Page size is measured per load] → the same `page` can show different listings on another screen
  size or zoom; acceptable, stated as out of scope.
- [Companies deep page costs N-1 requests on load] → same cost as clicking that page number today;
  lists are short.
- [A facet value deleted since the URL was written (e.g. a location id)] → the filter just matches
  nothing; the user can clear it.
