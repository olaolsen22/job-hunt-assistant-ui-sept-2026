# Reusables

Check here before writing a helper, component, or composable. Add a line when you create one;
remove it when you delete one.

## Components (`app/components/`)

- `<AppCard title?>` — `UCard` with an optional `h2` header. Default wrapper for page sections.
- `<AppConfirmModal v-model:open title description? confirm-label? loading? disabled? @confirm>` — confirm
  dialog with Cancel / confirm buttons; not dismissible while `loading`. The default slot is the
  body, so form modals (`<ListingsApplyModal>` etc.) wrap it too.
- `<AppMarkdownEditor v-model label>` — `UTextarea` for a Markdown note with a `n / 10000` counter
  (the API's max). Send the raw string; the API stores blank as null.
- `<AppMarkdownContent source>` — renders Markdown with `marked`, sanitized by DOMPurify, in
  `prose` (Tailwind typography). Use it as `<LazyAppMarkdownContent>` so both libs load only when a
  note is shown.
- `<DashboardApiHealth>` — API health indicator on the dashboard.
- `<DashboardWidget title icon icon-class? to? loading error empty empty-text total? @retry>` — dashboard card shell:
  header with title, count badge and "View all" link; skeleton, error alert with Retry, or empty text, else the default slot.
- `<DashboardRow id title company>` — one-link listing row for dashboard widgets; the default slot is the right-hand detail.
- Dashboard widgets (`<DashboardClosingSoon>`, `Interviews`, `Offers`, `Stale`, `Pipeline`, `AppliedThisWeek`, `ToAnalyze`,
  `FavoriteListings`, `FavoriteCompanies`, `LlmUsage`) — each runs its own literal query through `useAsyncData` (client-only).
- `<DashboardEditor :layout @saved @cancel>` — edit mode for the dashboard: copy of the saved layout with up/down and show/hide
  per widget, "Reset to default" (draft only), Save sends the whole list (`saveDashboardLayout`), shows the API message and keeps the edits on failure.
- `DASHBOARD_WIDGETS` (`constants/dashboard.ts`) — per `DashboardWidgetKind`: label, icon, component, `wide`. A `Record`, so a new
  kind from the API fails typecheck. `useDashboardLayout()` — `{ layout, loading, error, refresh }` for `dashboardLayout`.
- `<CompaniesFavoriteButton id favoritedAt>` — star toggle for a company; same optimistic behavior as the listing one.
  Uses `@click.prevent.stop`, so it can sit inside a link row.
- `<ListingsNameCombobox v-model lookup placeholder? countryCode?>` — debounced search over
  `companies` / `jobRoles` / `skills` / `industries` by name, or `locations` by city within `countryCode`;
  allows creating a new name; shows a "new" hint for created names and ones `useIsNewName` flags. Results are cached in `useState('name-lookups')` and filtered
  locally; clear it with `clearNuxtState('name-lookups')` after a save that can create names.
- `<ListingsForm v-model :validate submit-label cancel-to @submit>` — the listing form's fields
  and Cancel/submit buttons, shared by add and edit. `v-model` is `useListingForm().state`; the
  default slot renders above the buttons (error alert). The page owns mutation, confirm, errors.
- `<ListingsParseModal v-model:open listingId?>` — "Analyze ad" modal with tabs: From link (only with `listingId`;
  the API reads the saved URL), Paste ad (built-in `parseListing`, error shown in the tab) and Use your own AI (copy the
  `listingParsePrompt` + ad, paste the JSON back). The ad text is shared between the last two. Emits `apply` with the
  parsed object (feed it to `fillDraft` or `mergeDraft`); can't be closed while parsing.
- `<ListingsToggleGroup v-model :options>` — button group for an optional enum; clicking the
  active option clears it. Generic over the option value type. Rule in the form: 3 or fewer options use this, more use a
  clearable `USelectMenu` (`USelect` can't go back to empty).
- `<ListingsFilterPanel :facets v-model:sort v-model:search>` — the `/listings` toolbar (search, sort, "Filters (n)"
  toggle, clear all) and the facet panel, closed by default at every width; edits `facets` in place.
- `<ListingsFilterCombobox v-model lookup="skills" | "locations" placeholder?>` — multi-select search over
  existing skills (by name) or locations (by id, labelled `City, Country`); no create option.
- `<ListingsLocationsField v-model>` — `{ countryCode, city }[]` repeater (country picker + city combobox).
- `<ListingsSkillsField v-model>` — `{ name, level, minYears?, isRequired }[]` rows (two lines on phones, column headers from `sm`) + skill search below.
- `<ListingsLanguagesField v-model>` — `{ language, level?, isRequired }[]` rows, one per language.
- `<ListingsCard listing>` — plain `UCard` for one `ListingListItem`, stacked mobile-first: title
  (links to `/listings/{id}`) + `<ListingsFavoriteButton>` on one row, `<ListingsAnalyzedBadge>` on
  its own row below, then company, location `<ListingsLocation>`, `<ListingsDates>`, and a labelled
  "View ad" external link button.
- `<ListingsFavoriteButton id favoritedAt size?>` — star toggle button (`size` `xs` default, `md` in the detail header);
  owns its optimistic state and the `setListingFavorite` mutation. Used by `<ListingsCard>` and the listing detail page.
- `<ListingsAnalyzedBadge analyzedAt>` — "Analyzed" / "To analyze" badge. Used by `<ListingsCard>`
  and the listing detail page.
- `<ListingsStatusBadge status>` — application status badge (colors in `APPLICATION_STATUS_OPTIONS`).
  Used by `<ListingsCard>` and `<ListingsApplication>`.
- `<ListingsApplication listing @changed>` — the detail page's Application card: status/archived
  badges, company application count, Apply / Record outcome buttons per status, and
  `<ListingsStatusTimeline>` + `<ListingsInterviews>`. `@changed` = refetch the listing.
- `<ListingsStatusTimeline listing @changed>` — `UTimeline` of `statusHistory` with Edit
  (`<ListingsStatusChangeModal>`) per entry and Undo (confirmed) on the newest.
- `<ListingsInterviews listing @changed>` — upcoming/past interviews as "Round N · title", add/edit
  via `<ListingsInterviewModal>`, confirmed delete.
- `<ListingsApplyModal>`, `<ListingsOutcomeModal>`, `<ListingsStatusChangeModal>`,
  `<ListingsInterviewModal>` — `v-model:open` form modals (on `<AppConfirmModal>`) that own their
  mutation and emit `changed`.
- `<ListingsDocumentPicker v-model:document-id v-model:file label documents>` — pick an uploaded
  document or a new PDF (uploaded by the caller on submit); used twice by `<ListingsApplyModal>`.
- `<ListingsLocation listing>` — map-pin line of `City, Country` joined by `|`.
- `<ListingsDates listing>` — posted and deadline lines with icons (card and detail header), posted colored by days ago, deadline
  colored by days left to the server's `dueOn` (ASAP/Not stated show `due ~date`, or "likely filled" once past).

## Composables (`app/composables/`)

- `useListing(id)` → `{ listing, loading, error, refresh }` — client-only `listingById` query with every
  field (key `listing-${id}`), incl. application status, history, interviews and documents, for the
  detail and edit pages. Also exports `ListingDetail`.
- `useMutation(onStale?)` → `{ run, loading }` — `run(async () => payload.errors)` toasts the API's
  error message (or a generic one on a network error) and resolves `true` on success; a
  `*NotFoundError` calls `onStale` to refetch.
- `useListingForm()` → `{ state, validate, toInput, fill, fillDraft, mergeDraft }` — listing form state, `UForm` validator,
  mapping to the API's `ListingInput`, `fill(listing: ListingDetail)` to load an existing one, and
  `fillDraft(json)` to load a parsed draft (keeps only valid values, leaves `url`), and
  `mergeDraft(json)` to merge one into a filled form (parsed values win, saved ones stay where the parse is empty). Also exports `ListingLocation`, `ListingLanguage`,
  `ListingSkill` types.
- `provideNewNames()` → `{ checkNewNames(state) }` / `useIsNewName()` → `(lookup, name, countryCode?) => boolean`
  — the add page checks a filled form's names in one aliased query and provides the result;
  `NameCombobox` and `SkillsField` inject it to flag names the API doesn't know. No provider = nothing
  flagged. Also exports `NameLookup`.
- `useParsePrompt(name)` → `{ instructions, copied, load, copy(posting), parsing, parse(posting) }` — fetches
  `listingParsePrompt`, `listingQuickParsePrompt` or `companyParsePrompt` and copies it + `<posting>` text
  for an external AI. `parse()` runs the built-in parser (`parseListing`, FULL, QUICK or COMPANIES by `name`) and returns
  `{ result }` (the JSON reply) or `{ error }` for the caller to show; it doesn't toast. Call `load()` before the copy button is clickable (a clipboard write after an await can be refused).
- `useListingsList(grid)` → `{ listings, totalCount, counts, page, pageSize, filter, search, sort, facets, loading, error, refresh }` —
  `search` (bound to an input; starts as `?search=` from the URL, which the companies list links with) is debounced 300 ms and applies to the list and every count. `filter`
  (`'closingSoon' | 'toAnalyze' | 'archived' | null`, `ListingsFilter`) is the preset; `facets` (reactive
  `ListingsFacets`: favorites, statuses, skills, locationIds, postingLanguages, languages) AND with it and
  with the counts; `sort` (`'due' | 'newest' | 'changed'`). Any change resets to page 1. The query is built
  at runtime by the exported `buildListingsQuery(filter, facets, sort)` (a filter variable fails the API cost
  check, so only selected facets go into the `where` text). Picking statuses lifts the past-deadline
  exclusion. Offset-paged (bind `page`/`pageSize`/`totalCount` to `UPagination`). `grid` is a template ref
  to the cards' grid: on mount the page size is measured from it (rows that fit in the viewport x grid
  columns, 5 below `md`; fixed for the page load), then the single fetch starts (`immediate: false`).
  Client-only fetch (`server: false`) since it needs the session cookie. Also exports `ListingListItem`,
  `measurePageSize(grid, cardHeight?, gap?)` (also used by /companies), `emptyFacets()` and `countActiveFacets(facets)`.

## Stores (`app/stores/`)

- `useAuthStore()` → `{ user, fetchMe, login, loginAsGuest, logout }`.

## Utils (`app/utils/`, auto-imported)

- ``graphql(`...`, [fragments])`` — gql.tada document; result/variable types inferred from the API schema
  (`app/graphql-env.d.ts`, regenerate with `pnpm gql:gen`). Use `ResultOf<typeof DOC>` for derived types.
- `gql(document, variables?)` — POST to `/graphql`; result typed from the document; throws on GraphQL errors or missing data.
- `batchDocument<Item>(source)` — untyped runtime-built doc (one alias per item); caller names each alias's type.
- `formatDate(iso)` — formats a `YYYY-MM-DD` date string as `nb-NO` medium date (`26. sep. 2026`), parsed at local
  midnight (avoids the UTC-parsing off-by-one-day bug for negative-offset zones).
- `todayIso()` — local today as `YYYY-MM-DD` (not `toISOString()`, which is UTC).
- `daysAgoIso(n)` — local date `n` days back as `YYYY-MM-DD`; `localDayStartIso(n)` — UTC instant of local midnight `n` days back.
- `formatDateTime(iso)` — formats a `DateTime` instant as `nb-NO` medium date + short time, local zone.
- `toDateTimeLocal(value = now)` — a date/ISO string as local `YYYY-MM-DDTHH:mm` for
  `<input type="datetime-local">` (send back with `new Date(value).toISOString()`).
- `daysFromToday(iso)` — whole days from local today to a `YYYY-MM-DD` date; negative if past.

## Constants (`app/constants/`, import explicitly)

- `countries.ts` — `COUNTRY_CODES`, `COUNTRY_OPTIONS` (`{ label, value }`, sorted by English name).
- `listing.ts` — `*_OPTIONS` for the listing enums (`APPLICATION_STATUS_OPTIONS` also carries each
  status's badge color; `Outcome` is `OUTCOME_OPTIONS`' value type), `CEFR_LEVELS`, and their value types.
- `errorMessages.ts` — `ERROR_MESSAGES` for user-facing errors.
