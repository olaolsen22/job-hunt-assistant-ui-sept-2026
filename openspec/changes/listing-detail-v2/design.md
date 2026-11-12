# Design

## Context

See proposal.md (Why) and `specs/listing-overview/spec.md`. The layout comes from a clean-slate
`ui-ux-expert` pass that was not shown the v1 screen; reuse was checked by `ui-controller`.

Relevant current state:

- `useListing(id)` (`app/composables/useListing.ts`) is shared by five v1 pages and lacks
  company details, `jobRole.category`, `locations.isTarget`, `trainingProgram`, `createdAt`,
  `statusChangedAt` and `documents.sizeBytes`.
- `useRequirementMapQuery(listingId)` (`app/composables/useRequirementMap.ts`) reads the saved
  map under key `requirement-map-<id>`, client-only. `requirementMap.ts` has `matchCounts`,
  `requirementMapStale` and the kind/importance/match label lists.
- `dueOn` is computed by the API (the deadline itself, posted + 14 for ASAP, otherwise posted + 30).
  `dueSummary`, `deadlineLevel` and `URGENCY_TEXT` (`app/utils/dueUrgency.ts`) already turn it
  into the list's labels and colours.
- The default layout caps page content at `--ui-container` (87.5rem, about 1400 px) from 96rem
  viewports up, inside a collapsible dashboard sidebar.
- The listing description is plain text (v1 renders it with `whitespace-pre-line`); the company
  description and interview/status notes are rendered as markdown elsewhere.

## Goals / Non-Goals

**Goals:**

- One page, one listing query plus the saved-map query, both started at once.
- Page-specific pieces small enough to read, without changing any v1 component.

**Non-Goals:**

- Linking requirement evidence (`bulletIds`, `entries`) to profile text (needs the profile query).
- Replacing v1, adding nav links to v2, or extracting shared abstractions from v1.
- Contact interaction history, document preview/download, the "next interview" header swap.

## Decisions

1. **Own query, not an extended `useListing`.** `app/composables/useListingOverview.ts` holds a
   literal `graphql()` document for `listingById` with every field the spec shows, and a
   `useListingOverview(id)` that copies `useListing`'s pattern (`useAsyncData`, key
   `listing-overview-<id>`, `server: false`, awaitable refs). The type is
   `ResultOf<…>['listingById']`. Alternative, extending `useListing`, would make all five v1
   pages fetch company details and documents they do not show. When v2 replaces v1 the two
   queries can merge.
2. **No waterfall.** The page calls `useListingOverview(id)` and `useRequirementMapQuery(id)`
   before awaiting either. The Requirements section shows its own skeleton until the map query
   settles; a failed map query falls back to the plain skill list with a muted "Couldn't load
   the requirement map" line, since the page is still useful without it.
3. **Components under `app/components/listingOverview/`** (auto-imported as
   `ListingOverview<Name>`): `Header`, `Facts`, `Requirements`, `Progress`, `Company`,
   `Documents`, `Training`, `RecordDates`. Each takes the listing (or a `Pick` of it) as a prop
   and owns no fetching. The description stays inline in the page. Splitting is by section so
   each file stays readable and testable; nothing here is shared, so nothing goes into `app/`.
4. **Reuse, read-only:** `ListingsStatusBadge`, `CompaniesAvoidedBadge`, `CompaniesContactList`
   (default `editable` off), `AppCard`, `LazyAppMarkdownContent` (company description, notes),
   `dueSummary`/`deadlineLevel`/`URGENCY_TEXT`, `formatPlaces`/`formatLocation`,
   `formatOrgNumber`, `formatDate`, `matchCounts`, `requirementMapStale`, the requirement and
   listing `*_OPTIONS` labels, `languageLabel`, `CEFR_LEVELS`. **Not reused:** `StatusTimeline`,
   `Interviews`, `QuestionsCard`, `RequirementMapCard`, `RequirementNeedRow` (they carry
   mutations, modals or v1 layout), `ListingsDates` (says "Deadline:" in v1's stacked style and
   takes a list-item type; v2 shows the deadline as a header callout using the same utils),
   `ListingsLocation` (no target marker).
5. **Layout with container queries.** The page root is `@container`; the grid switches at
   Tailwind's built-in container sizes: one column below `@5xl` (64rem content), two columns
   (`2fr 1fr`) from `@5xl`, three columns from `@7xl` (80rem content). This follows the space left
   beside the sidebar instead of the viewport, so a collapsed sidebar switches earlier. Columns
   are nested grids in DOM order (header, facts, training, requirements, description, progress,
   side cards), so reading and tab order never change. Training sits full width after the facts
   at every width (not in the side column), so it stays "directly after the facts" on phones
   without being rendered twice. The app's `--ui-container` cap
   applies as on other pages; 2560 looks like 1920 with wider margins.
6. **Phone collapsing.** On phones (`useMediaQuery('(max-width: 39.99rem)')` from
   `@vueuse/core`, the pattern `pages/listings/index.vue` and `layouts/default.vue` already use),
   Progress, Documents, Contacts and Company render inside one `UAccordion` (multiple open,
   labels with counts). From the `sm` breakpoint up the same section components render inside
   `AppCard`s. The page is client-rendered (`server: false` data), so the media query is known
   before content shows and there is no hydration flip. Alternative: CSS-only `<details>`
   styled per breakpoint; rejected because it duplicates Nuxt UI's accordion and needs custom
   CSS. A viewport query is acceptable here because the sidebar is hidden on phones anyway.
7. **Description readability.** Plain text with `whitespace-pre-line` inside `max-w-prose`; the
   preview uses `line-clamp-12` and a "Show full description" `UButton` (variant link) shown only
   when the text overflows (measured client-side after mount).
8. **Badges and colours.** Match badges use theme colours with icon + word: Gap = error,
   Partial = warning, Evidenced = success. Facts and record dates use `text-muted` labels.
9. **Dates.** `formatDate` for days, plus a relative label only for the deadline and upcoming
   interviews.

## Risks / Trade-offs

- [Accordion vs card markup duplicated for phones] → Keep section content in the section
  components and only switch the wrapper in the page.
- [Requirement map stale after listing edits] → Show the existing `requirementMapStale` hint;
  regeneration stays on v1.
- [Second listing query drifts from `useListing`] → Accepted while v1 and v2 coexist; merge when v1
  is retired.
- [Three columns too tight at exactly 80rem content] → Check at 1440/1920 screenshots with the
  sidebar open and closed; move the switch, not the cap, if needed.

## Migration Plan

Additive route; nothing links to it yet. Rollback is deleting the page, its components and the
composable.
