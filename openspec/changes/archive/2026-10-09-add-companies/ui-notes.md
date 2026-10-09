# UI notes: companies pages

Mirrors `listings/index.vue` and `listings/quick-add.vue`. Nuxt UI + Tailwind built-ins only, no custom CSS.

## /companies (`app/pages/companies/index.vue`, title "Companies")

Root: `<div class="space-y-6">`.

1. Top bar: `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`.
   - `UInput` (icon `i-lucide-search`, placeholder "Search companies", `class="w-full sm:max-w-sm"`, trailing clear `UButton` like listings) `data-testid="companies-search"`. Debounce via `v-model.debounce`-style `watchDebounced`/`refDebounced` (300 ms); a change resets the cursor trail.
   - `UButton to="/companies/add" icon="i-lucide-plus" class="justify-center"` "Add companies" `data-testid="companies-add"`. Phone: full-width under the search (the column stacks). `sm+`: right-aligned. Same slot and look as "Add listing".
   - Hide search + heading while loading and when there is no data and no search (as listings does).
2. Heading line (only when rows or searching): `<p class="text-lg font-semibold text-highlighted">{{ totalCount }} companies</p>`, `data-testid="companies-total"`.
3. Rows: ONE responsive list, not a table. `<div class="grid gap-3" data-testid="companies-list">` of `UCard` rows, each wrapped in `NuxtLink :to="{ path: '/listings', query: { search: name } }"` (whole card is the link; `block` on the link, `hover:bg-elevated transition` on the card is enough, or `UCard :ui` none).
   - Card body: `flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-6`.
   - Name + industry block: `min-w-0 lg:flex-1`
     - name: `<p class="truncate font-medium text-highlighted">`
     - industry: `<p class="truncate text-sm text-muted">` (omit if null)
   - Locations: `<p class="flex min-w-0 items-center gap-1 text-sm text-muted lg:flex-1">` with `i-lucide-map-pin size-4 shrink-0` + a `truncate` span of `City, NO · NO · ...`. Omit if none. Phone: wraps under the name; lg: its own column.
   - Counts: `flex shrink-0 gap-2` with two `UBadge color="neutral" variant="subtle"`: `i-lucide-briefcase` "{{ n }} listings", `i-lucide-send` "{{ n }} applications" (singularise at 1). Phone: sit on the bottom line; lg: right end of the row. A row is always 2-3 lines on phone, one line on lg, so no horizontal scroll and no table needed.
   - Row testid `companies-row`; badges `companies-row-listings`, `companies-row-applications`.
4. Loading: `USkeleton v-for="i in 6" class="h-20 w-full lg:h-16"` inside the same grid.
5. Error: `UAlert color="error" :description="ERROR_MESSAGES.generic"`.
6. Empty (no search): copy listings' empty block, `data-testid="companies-empty"`: `flex flex-col items-center gap-3 py-16 text-center`, `i-lucide-building-2 size-10 text-muted`, "No companies yet.", `UButton to="/companies/add"` "Add companies". Empty with a search: "No companies match." and no button.
7. Pager (only when `totalCount > pageSize`): `flex items-center justify-between gap-2 sm:justify-end`
   - `<span class="text-sm text-muted" data-testid="companies-range">1-20 of N</span>` (start = trail.length*size+1, end = start+rows-1)
   - `UButton icon="i-lucide-chevron-left" color="neutral" variant="outline" :disabled="!trail.length || loading"` label "Prev" `companies-prev`; `trailing-icon="i-lucide-chevron-right"` "Next" `:disabled="!pageInfo.hasNextPage || loading"` `companies-next`. Phone: range left, buttons right via `justify-between` wrapping the buttons in `flex gap-2`; `sm+`: all right-aligned with `gap-3`.
   - Page size: fixed 20 (no grid-height measuring; keep it dumb).

## /companies/add (`app/pages/companies/add.vue`, title "Add companies")

Same skeleton as quick-add: `UForm class="space-y-4" data-testid="companies-add-form"`, `ref="form"`, `:validate`, `@submit="onSave"`. Testid prefix `companies-add-`.

1. Paste card (`pasteOpen`): `UCard data-testid="companies-add-paste"`, same two-step layout as quick-add. Differences only in copy:
   - checkbox "Use built-in parser" `companies-add-builtin`
   - label "Paste company names, or a page that lists companies"; help "Only name, industry and locations are parsed."
   - textarea `companies-add-ad`; built-in button `companies-add-builtin-run`; copy button `companies-add-copy-prompt`
   - reply textarea `companies-add-json` (`font-mono`); parse button `companies-add-parse`; empty-reply error "No companies found in that reply."
2. Summary line (when `!pasteOpen`): `flex items-center justify-between gap-2`; `<p class="text-sm text-muted">Pasted N companies. Check them below, then save.</p>` + ghost "Paste more" button (`i-lucide-clipboard-paste`). Testids `companies-add-paste-summary`, `companies-add-paste-more`.
3. Row card (unsaved): `UCard data-testid="companies-add-row"`. Fields are short, so no second line:
   - `grid gap-3 sm:grid-cols-2 lg:grid-cols-[...]` is NOT needed. Use `grid gap-3 sm:grid-cols-2` for name + industry, then locations full-width below, remove button top-right.
   - Phone: Name, Industry, Locations stack full-width; remove button sits in a header line: `<div class="flex justify-end">` is wasteful, so instead put it in the Name row: `flex items-end gap-2` = `UFormField` (Name, `flex-1`) + trash `UButton` (ghost, neutral, `i-lucide-trash-2`, `companies-add-row-remove`). Same pattern as quick-add's "Posted on" + trash.
   - Row grid: `<div class="grid gap-3 sm:grid-cols-2">`
     - Name cell: `flex items-end gap-2 sm:col-span-1`: `UFormField label="Name" required eager-validation :name="`${row.key}.name`" class="min-w-0 flex-1"` + `ListingsNameCombobox lookup="companies" placeholder="Search or add"`.
     - Industry cell: `UFormField label="Industry"` + `ListingsNameCombobox lookup="industries" placeholder="Search or add"`.
     - Hmm trash placement: on `sm+` the trash stays beside Name (left column), acceptable; if it looks off, move it to the card's end.
   - Locations: `<div class="mt-3">` with `ListingsLocationsField v-model="row.locations"` full-width (its own repeater already stacks country + city). `UFormField label="Locations"` wrapper. Validation names `${row.key}.locations`.
   - After parsing: `await nextTick(); form.value?.validate({ silent: true })` plus `eager-validation` on fields, exactly as quick-add (reason is in its comment).
4. Result card (saved), `UCard data-testid="companies-add-row-saved"`: `flex items-start gap-3`, `i-lucide-circle-check size-5 shrink-0 text-success`, `min-w-0 flex-1`: `<p class="truncate font-medium text-highlighted">{{ name }}</p>`; no link, no remove (spec: no delete). Subline `text-sm text-muted`: industry + locations if any.
   - Variant existed (`created === false`), `data-testid="companies-add-row-existing"`: icon `i-lucide-info` `text-muted` (not success), plus `<p class="text-sm text-muted">Already existed, left unchanged</p>` or a `UBadge color="neutral" variant="subtle"` with that text on the right (`shrink-0`). Prefer the text line: wraps fine on phone.
5. Error banner: one `UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="saveError" data-testid="companies-add-error"` placed ABOVE the rows (right after the paste card/summary, before the `v-for`). Shows the API messages joined with " ". Rows untouched.
6. Save bar (identical to quick-add): `flex flex-col-reverse gap-2 sm:flex-row sm:items-center`.
   - "Add row" ghost button `companies-add-add-row` left.
   - `div class="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row"`: `UButton to="/companies" color="neutral" variant="ghost"` {{ anySaved ? 'Done' : 'Cancel' }}; `UButton type="submit"` "Save N companies" / "Save 1 company", `:loading :disabled="!pending.length"`, `companies-add-save`.
   - Phone: Save on top (flex-col-reverse), full-width, `justify-center`.
7. Toast: "N companies added" counting only `created === true`.

## Nav

`layouts/default.vue`: add "Companies" next to "Listings" (`i-lucide-building-2`); reuse the existing nav item shape.

## Open UX questions

- Whole-card link on a company row vs. a small "View listings" link: whole card chosen (fewest clicks); say if you want a visible affordance (trailing `i-lucide-chevron-right` on lg).
- Trash button beside Name on `sm+` is a tad odd; alternative is card-end placement.
