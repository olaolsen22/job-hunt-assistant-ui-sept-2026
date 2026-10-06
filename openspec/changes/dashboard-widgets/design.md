## Context

`useListingsList` already builds its `listings` query from fixed clause strings, because a
`ListingFilterInput` variable fails the API cost check (HC0047). The widgets avoid it by using static clauses,
and the companies list rows are whole-row links, which matters for the favorite star.

## Decisions

- **Literal documents, no query builder.** Each widget is a literal `graphql()` document with a static `where` and
  scalar variables (`$today`, `$from`/`$to`, `$now`, `$since`), fetched with its own `useAsyncData` (client-only, like
  `/listings`) so loading, error and retry are per widget. Only a whole `ListingFilterInput` variable fails the cost
  check, and none is used. Vue 2 note: `useAsyncData` is the `asyncData` hook split per call, so several can live in one page.
- **Shared widget shell** `DashboardWidget` (title, icon, "view all" link, loading/empty/error slots) used by all
  nine widgets: that is a real 9-use abstraction. A shared compact row (`DashboardListingRow`) is used by the
  listing widgets. Widgets are not made data-driven beyond that.
- **Stale** = `status SAVED`, `deadlineType neq DATE`, `postedOn` between `today-45` and `today-14` (`$from`/`$to` LocalDate variables), `order postedOn ASC`, `archived`
  left at its default `false`. No `EXPIRY` clause: ASAP listings expire at posted+14 on the server, so the usual
  expiry exclusion would hide exactly the listings this widget is for. "N days old" is `daysFromToday(postedOn)`.
- **Upcoming interviews**: `Listing.interviews` takes only `order`, and there is no top-level interviews query.
  So the widget asks for `status eq INTERVIEWING` listings with `interviews: { some: { scheduledAt: { gte: $now } } }`
  (an Offer listing with a round still scheduled is deliberately left out), takes interviews ordered by `scheduledAt`, then
  flattens, drops past ones and sorts client-side, keeping 5. Fetch `take: 10` listings so the flattening has
  enough to fill five rows.
- **Pipeline counts**: seven aliased `listings(take: 1) { totalCount }` fields in one request, like the counts in
  `buildListingsQuery`. Risk: cost. If the API rejects it, fall back to the statuses worth watching
  (Saved, Applied, Interviewing, Offer) and report it.
- **Applied this week**: `status eq APPLIED`, `statusChangedAt gte $weekAgo` (a DateTime variable of the local day
  start, as ISO). It is a rough count: a listing that has moved on to Interviewing no longer counts.
- **Favorited companies**: two requests in one widget, run sequentially because the second needs the first's ids:
  `companies(where: { favoritedAt: { neq: null } }, order: { favoritedAt: DESC }, first: 5)`, then one `listings`
  query for all of them: `companyId: { in: $ids }`, `status: SAVED` plus the expiry clause, `take: 30`, grouped by
  `companyId` client-side. This is one extra request, not one per company, and `$ids` is a scalar list like the
  facet `in` lists. Companies are capped at 5; listings per company are shown up to 3 with "+N more".
- **Links into `/listings`**: `/listings` reads `?filter=closingSoon|toAnalyze`, `?status=A,B` and `?favorites=1`
  once at setup, the way it already reads `?search=`, and validates them against the known values. Stale links to
  `?status=SAVED`: the age cut-off has no facet, so the list is a superset (documented in the widget's link title).
- **Company favorite button**: `companies/FavoriteButton.vue`, same shape as `listings/FavoriteButton.vue`
  (optimistic flip, rollback with a toast). It is not merged into one component: two copies is under the "2+ real
  uses" bar only if generalising is cheap, and the mutation, payload and test ids differ. Revisit if a third appears.
  Inside the row's `<NuxtLink>` the click handler uses `@click.prevent.stop` so it neither navigates nor bubbles
  (Vue 2: same modifiers, but `.prevent` is what stops the anchor here).
- **Dates**: "today" is the local date (`sv-SE` format), as in `buildListingsQuery`.

## Risks

- Pipeline counts and the nested favorited-companies query may hit the cost limit; both are built so a clause can be
  dropped without reshaping the widget.
- `Company.favoritedAt` is not in `app/graphql-env.d.ts` until `pnpm gql:gen` runs.
