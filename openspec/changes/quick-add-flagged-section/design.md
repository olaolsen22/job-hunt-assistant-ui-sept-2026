# Design

## Context

`app/pages/listings/quick-add.vue` renders `state.rows` in one `v-for`: a saved card (with duplicate and
previous-attempt `UAlert`s) or an editable card. Flags live on the row (`duplicates`,
`previousAttempts`) and are cleared by setting them to `undefined`. Layout advice came from ui-ux-expert.

## Goals / Non-Goals

**Goals:** Compare reads as the main action; flagged rows stand apart; no new state store.

**Non-Goals:** Changing `ListingsCompareModal`, reusing the groups elsewhere, extracting components.

## Decisions

- **Sections as computeds over `state.rows`**: `flagged` (saved and `duplicates || previousAttempts`),
  `added` (saved, no flags), `pending` (already exists). Clearing a flag moves the row with no extra code.
  Headings only render when `savedCount > 0`, so the pre-save page is unchanged.
- **One Compare button per note**: primary solid `UButton icon="i-lucide-columns-2"`, label
  "Compare" or "Compare (N)" for several matches, opening `openCompare(row, row.duplicates[0].id)`. The
  modal's existing "Compare with" select covers the others, so per-match buttons are redundant.
  Keep both → `neutral`/`subtle` (as in the modal); Remove → "Remove new one", `error`/`soft`. Drop
  `size="sm"` so the app's `lg` button default applies.
- **Got it** on the previous-attempts alert: neutral subtle button, sets `row.previousAttempts = undefined`.
- **`UCollapsible`** for the added group, not `UAccordion` (built for an `items` array; one group is
  overkill). First Nuxt UI collapsible in the app. In Vue 2 terms it's a ready-made `v-show` toggle with
  a slot for the trigger; `v-model:open` replaces the `.sync` prop. Trigger: full-width
  `UButton color="neutral" variant="subtle" block icon="i-lucide-circle-check"` with a chevron, matching
  the Filters toggle in `app/components/listings/FilterPanel.vue`. Closed by default; the user's choice
  holds across "Paste more" batches (plain `ref(false)`).
- **Compact added list**: one `UCard` with a `divide-y` list, each line a truncated title `NuxtLink` and
  a muted company · role line. It's a receipt, so no URL or icon.
- **Section order**: Needs a look → added group → Not saved, so unsaved rows sit next to Save.
- Match/attempt title links get `target="_blank"`.

## Risks / Trade-offs

- [Spec dependency] This modifies a requirement added by `quick-add-duplicate-compare` → archive that
  change before this one, or `openspec archive` won't find the requirement.
- [Rows reorder on save] Rows move from one list into sections → acceptable; the toast and counts say
  what happened.
- [Test selectors change] `quick-add-row-compare` is now one per note → update tests in the same task.
