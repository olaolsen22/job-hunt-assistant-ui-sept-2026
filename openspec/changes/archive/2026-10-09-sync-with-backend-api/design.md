# Design

## Context

The change spans constants, five listing components, three composables, and three pages, so a few
choices need to be settled before coding. Constraints already in the codebase:

- `useListingsList` uses one literal gql.tada document per filter. Filters are inlined, not passed
  as a `ListingFilterInput` variable, because the API's cost check prices a filter variable as every
  possible field. Plain arguments like `search: String` and `dueWithinDays: Int` are cheap scalar
  arguments, so they can be variables.
- `ListingsDates` hardcodes `ASAP_DUE_DAYS = 14` and computes the ASAP due date on the client.
  `Listing.dueOn` now gives the server's value (DATE → `deadlineOn`, ASAP → posted + 14,
  UNSPECIFIED → posted + 30).
- `useMutation.run` toasts the API's error messages for typed errors.

## Goals / Non-Goals

**Goals:**

- Each new backend capability is used with the fewest new moving parts. No new composables or
  components unless there are 2+ uses.

**Non-Goals:**

- Syncing search or filter state to the URL query (not asked for; the filter isn't in the URL today either).
- Showing `dueOn` anywhere besides `ListingsDates`.

## Decisions

### Search as a variable on every list query

Add `$search: String` to all five list queries (default, toAnalyze, active, archived, closingSoon)
and to every `listings(...)` call in the `ListingCounts` fragment, so the counts follow the search.
`useListingsList` gets a `search` ref. A debounced copy (300 ms) goes into `useAsyncData`'s
`watch` and resets `page` to 1. The debounce is a plain `setTimeout` watcher like `NameCombobox`'s,
because `@vueuse/core` isn't a direct dependency. A blank value is sent as `null`.

- Alternative: client-side filtering of the current page. Rejected: it only sees one page.
- Alternative: search only the list, not the counts. Rejected: a button saying "3 to analyze" that
  shows 1 result is confusing, and the cost is one extra argument per `listings` call.

### "Closing soon" as a fifth filter query

Add `closingSoon: listings(take: 1, dueWithinDays: 7, search: $search) { totalCount }` to the counts
fragment and a `LISTINGS_CLOSING_SOON` query with `dueWithinDays: 7`, keeping the server's default
order. Inline `7` in the literal, consistent with the inlined filters. Add a `closingSoon` key to
`QUERIES` and an entry to `FILTERS` in `listings/index.vue`. Seven matches the green "≤ 7 days"
color bucket in `ListingsDates`.

### `ListingsDates` reads `dueOn`

Add `dueOn` to the `ListingListItem` fragment and to `useListing`'s detail query. Narrow the prop to
`'postedOn' | 'deadlineType' | 'deadlineOn' | 'dueOn'`. Days left = `daysFromToday(dueOn)` for every
type, which removes `ASAP_DUE_DAYS`, `asapDueDaysLeft`, and the client-side date addition.
Non-DATE types render as `<type label>, due ~<formatDate(dueOn)>` or `<type label>, likely filled`.
The "N days since posted" label goes away, because Not stated now has a due date.

### Outcome labels depend on the current status

`OUTCOME_OPTIONS` stays the single list of outcome values, with `ACCEPTED` added.
`ListingsApplication` already computes which outcomes are allowed. Extend it: from OFFER return
`['ACCEPTED', 'REJECTED', 'WITHDRAWN']`. `OutcomeModal` gets labels for the OFFER context (Offer
withdrawn / Declined) through an optional `labels` override built in `Application.vue`, instead of
a second constant. The button text becomes "Record outcome" in every status (it was "Withdraw"
for OFFER).

- Alternative: a separate `OFFER_OUTCOME_OPTIONS` constant. Fine too; pick whichever reads simpler
  during implementation. Either keeps the API values in one place.

### Undo error link

Add `... on DuplicateListingError { existingListingId }` to the `UndoStatusChange` document. The
generic `useMutation` toast has no link, so `StatusTimeline` handles this one error type itself:
a toast with an action button `{ label: 'View open listing', to: '/listings/<id>' }`. Every other
error still goes through `useMutation`.

### Previous attempts

- `add.vue`: request `previousAttempts { id title status }`. If any are returned, the success toast
  gets a description ("You applied to this posting before") and an action linking to the newest
  attempt (the API returns them newest first). Navigation to `/listings` stays as it is.
- `quick-add.vue`: add `previousAttempts { id title status }` to the `R` fragment and a
  `previousAttempts` field on `Row`. Render a neutral/info `UAlert` per row with a link and a
  `ListingsStatusBadge` per attempt, next to the existing duplicates note. The ui-ux-designer
  task settles the exact placement.

### ROLLING in parsed drafts

`fillDraft` in `useListingForm` and `quick-add.vue`'s draft mapping map `'ROLLING'` → `'ASAP'`
before the option lookup. One inline line each with a comment pointing at the backend note. A
shared helper isn't worth it for one line in two places.

### UI decisions (from the ui-ux-designer pass)

- Search: a second toolbar row above the heading and filter chips, a full-width `UInput` (`sm:max-w-sm`,
  `i-lucide-search`, clear button in the trailing slot while non-empty). The toolbar guard becomes
  `listings.length || filter || search` (raw `search`, not the debounced copy), and the same flag
  drives the "No listings match" text and hides the empty-state "Add listing" button.
- Closing soon: first entry in `FILTERS`, `color: 'error'`, `icon: 'i-lucide-alarm-clock'`,
  label "closing soon"; same hide-at-zero rule as the others.
- Badges: Offer `success` subtle. Accepted `success` solid plus `i-lucide-party-popper`, so it
  differs from a prominent (solid) Offer by the icon. Withdrawn stays outline.
- Quick-add previous attempts: a second `UAlert` after the duplicates alert (`color="neutral"`,
  `variant="subtle"`, `i-lucide-history`, title "Applied to this URL before"), a list of title link
  - `ListingsStatusBadge`, `data-testid="quick-add-row-previous-attempts"`.
- Add page: the success toast gets description "You closed an earlier listing for this URL (<status>)."
  and a "View previous attempt" action to the first item (the API returns newest first).
- Debounce stays a `setTimeout` watcher: `refDebounced` isn't used in the app and VueUse isn't a direct dependency.

## Risks / Trade-offs

- [Server "today" is UTC, the UI's is local] → `dueOn` itself is a date with no time zone. Only the
  expired check runs on local today, as before. Near midnight the list's expired order and the badge
  can differ for a few hours. Acceptable.
- [Status badge color for ACCEPTED] → Offer and Accepted both mean "good news". The designer task
  picks the colors, e.g. Accepted = `success` solid/subtle and Offer moved to another token, so
  they don't look the same.
- [Counts query gets heavier] → one more `listings` count (`closingSoon`) per request. It's a
  `take: 1` count query, the same pattern as the existing three.
- [Stale e2e mocks] → mocks still return `ROLLING` and no `dueOn`. They must be updated or the e2e
  render breaks (`dueOn` undefined → `formatDate` on undefined).

## Migration Plan

Frontend only. Deploy after the backend (already live). No rollback concerns: a revert brings
back the ROLLING/ACCEPTED crashes.
