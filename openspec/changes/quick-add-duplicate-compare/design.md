# Design

## Context

`quick-add.vue` saves rows with one aliased `createListing` per row (`RESULT_FRAGMENT`). The payload
already returns `listing` and `possibleDuplicates` as full `Listing`s, but the fragment only selects
id/title/url and id/title/archivedAt/company/jobRole. The duplicate note's "Keep both" clears
`row.duplicates`; "Remove this one" goes through `askRemove(row)` → `AppConfirmModal`.

## Goals / Non-Goals

**Goals:** one compare layout that works on phones and desktop without separate components.

**Non-Goals:** merging, editing, or comparing outside quick-add.

## Decisions

- **Data from the save response.** Extend `RESULT_FRAGMENT` with `url postedOn deadlineType
deadlineOn status createdAt locations { location { city countryCode } }` on `possibleDuplicates`,
  and `postedOn deadlineType deadlineOn locations { … }` on `listing`. The new side uses the saved
  `listing` (API-cleaned values, e.g. URL) with company/role names from the row. No extra query, so
  no loading or error state in the modal. Alternative: fetch the match by id on open — an extra
  request for data already available.
- **One row-per-field grid instead of two cards.** `ListingsCompareModal` renders a `dl`; each row is
  `grid sm:grid-cols-[8rem_1fr_1fr]` (label, New, Existing). Below `sm` the same row collapses:
  label as a small muted caption, then two lines each prefixed with a `UBadge` ("New" neutral,
  "Existing" warning). Tabs, swipe, or a `UDrawer` were rejected: they hide one side, which defeats
  comparing, and a drawer is a new pattern in this app.
- **Difference marking.** Differing rows get `bg-elevated` and `text-highlighted font-medium` values;
  matching rows get a muted `i-lucide-check`. Empty values render `—` in `text-dimmed`. Values are
  compared after formatting (same string = same), so e.g. location order doesn't need special rules
  beyond the formatter.
- **Width.** `UModal` defaults to `sm:max-w-lg`, too narrow for three columns; use
  `:ui="{ content: 'sm:max-w-3xl' }"` with a comment. On phones the default modal scrolls its body
  while the footer stays put, so no `fullscreen` toggle (avoids adding `useBreakpoints` for one use).
- **Multiple matches.** The modal takes the row and a selected match id; a `USelect` ("Compare
  with", items "title · company") shows only for 2+ matches.
- **Actions.** Footer: Open existing (`to`, `target="_blank"`, neutral ghost), Keep both (neutral
  subtle), Remove new one (error soft). The modal emits `keep` / `remove`; the page reuses its
  existing handlers, closing the compare modal before `askRemove` opens the confirm so two modals
  never stack. Keep both dismisses the whole note (matches the note's own button).
- **Reuse.** `ListingsStatusBadge` for status, `formatDate`, `formatLocation`/`formatPlaces` for
  values, `DEADLINE_TYPE_OPTIONS` labels for the deadline. `ListingsDates` / `ListingsLocation` are
  not reused: they render icon rows with urgency colors and need `dueOn`.

## Risks / Trade-offs

- [Larger mutation response for big batches] → only a handful of scalar fields per row; acceptable.
- [`:ui` width override] → documented with a comment; no built-in size prop exists on `UModal`.
