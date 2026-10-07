# Design

## Context

- **Schema:**
  - There is no `company(id)` query. The single listing page has `listingById`, but a company has to
    be loaded through `companies(where: { id: { eq: $id } }, first: 1)`.
  - `listings` leaves archived listings out unless it gets `archived: true`.
  - Filter shapes must be literal text with scalar variables inside them. A `ListingFilterInput`
    variable fails the cost check (HC0047), and `first` must be literal too.
- **UI today:** `/companies` keeps search and page in the URL with an inline `router.replace` watcher.
  Rows are a whole-card `NuxtLink` to `/listings?search=` with the favorite button nested inside the
  link.
- **Patterns to copy:** the listing page (`listings/[id]/index.vue`) for the header, Back, the More
  menu, the archived notice and loading/error states. The listing edit page (`listings/[id]/edit.vue`)
  for the save, replace and back flow.

## Goals / Non-Goals

**Goals:**

- One request loads the whole company page.
- Reuse the existing listing page patterns, Markdown components and company fields.

**Non-Goals:**

- A shared company form for add and edit. `add.vue` is a multi-row grid; extract a form only if the
  two end up sharing real markup.
- Pagination of positions.

## Decisions

- **One query for the page:** a single `CompanyPage($id: Int!)` document with three fields:
  - `companies(where: { id: { eq: $id } }, first: 1)`
  - `open: listings(take: 50, where: { companyId: { eq: $id } })`
  - `archived: listings(take: 50, archived: true, where: { companyId: { eq: $id } })`

  This avoids a waterfall. `take: 50` (API max 100) keeps the two fields' cost low, since a company
  rarely has more than a handful of listings. No pager.

- **Positions:**
  - Merge both lists and sort client-side by a status rank (in progress → Saved → finished), with
    archived listings last.
  - Rows reuse `DashboardRow`, with its `company` prop renamed to `subtitle` (the job role here), plus
    `ListingsStatusBadge` and an Archived badge.
  - Alternative: split into Applied and Open sections. Rejected, because with few listings per
    company it mostly shows empty halves.
- **Stats:** a small `dl` grid computed from the merged listings:
  - Listings and Applications: listing count, and `applicationCount` from the API
  - In progress: APPLIED, INTERVIEWING, OFFER
  - Interviewed: current status INTERVIEWING, OFFER or ACCEPTED. A listing rejected after an interview
    is not counted, since that would need per-listing history (out of scope).
  - Offers: OFFER, ACCEPTED
  - Rejected: REJECTED
- **Notes:**
  - An `AppCard` with a ghost pencil button. Content goes through `LazyAppMarkdownContent`.
  - Editing happens in a `UModal` with `AppMarkdownEditor`, like `InterviewModal`.
  - `setCompanyNotes` sends the text as typed; the API trims and clears.
  - Notes stay off the edit page, because they have their own mutation.
- **Avoid:**
  - It goes in the More menu, as it is a rare action. Avoiding confirms with `AppConfirmModal`;
    stopping does not.
  - Uses `useMutation(refresh)` and a toast, like `toggleArchived` on the listing page. This one
    isn't optimistic, because the badge and notice re-render from the refreshed data.
  - Badge: `UBadge color="warning" variant="subtle" icon="i-lucide-ban"`. `error` red is already used
    for Rejected.
  - Wording: "Avoided" on company surfaces and "Avoided company" on listing surfaces, so it doesn't
    read as a listing state.
- **Avoided on listings:** add `company { id avoidedAt }` to the `ListingListItem` fragment and to
  `ListingById`. The badge goes beside `ListingsAnalyzedBadge` in `ListingsCard` and in the listing
  page header. The company name on the listing page links to `/companies/<id>`, which is cheap now
  that `id` is fetched.
- **Hide avoided:**
  - `hideAvoided` is a URL query flag (`?hideAvoided=1`). The query adds
    `where: { avoidedAt: { eq: null } }` when it is on.
  - Since `where` must be literal, it is spliced into the printed query text, the same way the page
    already swaps in the measured `first`. That is simpler than keeping two documents in sync.
  - Toggling resets cursors and page, like search. The button follows the `/listings` quick-filter
    pattern (`subtle` → `solid`, `i-lucide-eye-off`) in the heading row.
- **Back:** add `useCompaniesView = () => useState('companiesView', () => '/companies')` next to
  `useListingsView`. `/companies` sets it on every URL change, and the company page's Back uses it.
  Two one-liners are simpler than a parameterized helper.
- **Company rows:**
  - Switch to the stretched-link pattern from `ListingsCard`: the title is the `NuxtLink` with an
    `after:absolute after:inset-0` overlay, and the favorite button sits on `relative z-10`.
  - This fixes the nested interactive element.
  - The `.prevent.stop` on `CompaniesFavoriteButton` stays (harmless).
- **Edit page:**
  - The name is a plain `UInput`, since the companies combobox would suggest merging into another
    company.
  - Industry uses `ListingsNameCombobox lookup="industries"` and locations use
    `ListingsLocationsField`. Copy the `toInput` mapping from `add.vue`.
  - On save:
    - `clearNuxtState('name-lookups')`
    - refresh the company page key
    - `router.back()` if `history.state.back` is the company page, otherwise
      `navigateTo(..., { replace: true })`. Same as the listing edit page.

## Risks / Trade-offs

- `avoidedAt: { eq: null }` on a DateTime filter is assumed to work, as with `analyzedAt: { eq: null }`
  in listing presets. That case is already proven, so the risk is low.
- The `DashboardRow` prop rename touches every dashboard widget call site. It's a mechanical change.
- Company rows no longer open a `/listings` search. The company page's positions list replaces that.

## Implementation notes

- `CompaniesAvoidedBadge` (4 uses) and `formatPlaces` (3 uses) were extracted.
- `ListingsNameCombobox` got an opt-in `clear` prop, so the industry can be cleared on the edit page.
- The notes dialog shows API errors inline (per spec), not as a toast through `useMutation`.
- The edit page saves without a confirm dialog: a company edit is small and easy to redo.
