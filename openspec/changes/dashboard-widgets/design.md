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
  ten widgets: that is a real 10-use abstraction. A shared compact row (`DashboardListingRow`) is used by the
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

## Customizable layout

- **Registry, not a switch.** `app/constants/dashboard.ts` maps each `DashboardWidgetKind` to
  `{ label, icon, component, wide? }`, typed as a `Record` so a kind the backend adds fails typecheck instead of silently
  not rendering. Components are imported, not looked up by name: auto-imports only resolve literal names in templates.
  The page renders `layout.filter(shown)` with `<component :is>`; each widget sits in a `grid` wrapper so the card
  stretches to the row height and `wide` (Pipeline) takes `lg:col-span-2`. Vue 2 note: same dynamic `<component :is>`,
  but in `<script setup>` you pass the component itself, not a registered-name string.
- **Hidden = not mounted**, so a hidden widget's `useAsyncData` never runs.
- **Layout fetch**: `useDashboardLayout` (`useAsyncData('dashboard-layout')`, client-only). Error shows the alert with a
  retry and the API health card stays below. A save swaps in the mutation's returned `layout`, so there is no refetch.
- **Edit mode is a local copy** (`DashboardEditor`, in place of the grid): up/down swap neighbors, a `USwitch` shows or
  hides, Save sends the list as is, Cancel drops the copy. No drag-and-drop: it needs a package for a ten-item list and
  up/down works on touch.
- **Reset to default** rewrites only the local copy. The API has no reset mutation and no default-order field, so the
  default is the registry's key order, which mirrors the `DashboardWidgetKind` declaration order (the server's
  default). Keep the registry in enum order.
- **No groups.** A user order can interleave what used to be groups, so the headings are gone: one
  `grid gap-4 lg:grid-cols-2`. An odd gap beside a full-row Pipeline is the user's choice and is not handled.

- **LLM usage** (`LLM_USAGE`, last in the enum, so last in the registry and the default order): one widget, one
  `llmUsageToday` query, no link out. Shows `requests` of `requestsLimit` with `remainingRequests` and a progress bar when
  the limit is set, only the request count when it is null, the token totals, and `resetsAt` in local time. The numbers
  cover all users (one Gemini key, one quota). The API requires every save to include all ten kinds.

## Risks

- Pipeline counts and the nested favorited-companies query may hit the cost limit; both are built so a clause can be
  dropped without reshaping the widget.
- The generated types don't know `Company.favoritedAt` or the layout operations until `pnpm gql:gen` runs.
- A widget kind the registry lacks would be skipped; the `Record` type is the guard.
