# Reusables

Check here before writing a helper, component, or composable. Add a line when you create one;
remove it when you delete one.

## Components (`app/components/`)

- `<AppCard title?>` — `UCard` with an optional `h2` header. Default wrapper for page sections.
- `<AppConfirmModal v-model:open title description? confirm-label? loading? @confirm>` — confirm
  dialog with Cancel / confirm buttons; not dismissible while `loading`.
- `<DashboardApiHealth>` — API health indicator on the dashboard.
- `<ListingsNameCombobox v-model lookup placeholder? countryCode?>` — debounced search over
  `companies` / `jobRoles` / `skills` by name, or `locations` by city within `countryCode`;
  allows creating a new name; shows a "new" hint for created names and ones `useIsNewName` flags. Results are cached in `useState('name-lookups')` and filtered
  locally; clear it with `clearNuxtState('name-lookups')` after a save that can create names.
- `<ListingsForm v-model :validate submit-label cancel-to @submit>` — the listing form's fields
  and Cancel/submit buttons, shared by add and edit. `v-model` is `useListingForm().state`; the
  default slot renders above the buttons (error alert). The page owns mutation, confirm, errors.
- `<ListingsParseModal v-model:open @apply>` — paste an ad, copy the `listingParsePrompt` + ad for
  an external AI, paste its JSON back; emits the parsed object (feed it to `fillDraft`). Built-in
  parse is a disabled option until the API has it.
- `<ListingsToggleGroup v-model :options>` — button group for an optional enum; clicking the
  active option clears it. Generic over the option value type.
- `<ListingsLocationsField v-model>` — `{ countryCode, city }[]` repeater (country picker + city combobox).
- `<ListingsSkillsField v-model>` — skill search + `{ name, level, isRequired }[]` rows.
- `<ListingsLanguagesField v-model>` — `{ language, level?, isRequired }[]` rows, one per language.
- `<ListingsCard listing>` — plain `UCard` for one `ListingListItem`: title (links to
  `/listings/{id}`), company, location `<ListingsLocation>`, `<ListingsDates>`,
  `<ListingsFavoriteButton>`, external "View posting" link.
- `<ListingsFavoriteButton id favoritedAt>` — star toggle button; owns its optimistic state and
  the `setListingFavorite` mutation. Used by `<ListingsCard>` and the listing detail page.
- `<ListingsLocation listing>` — map-pin line of `City, Country` joined by `|`.
- `<ListingsDates listing>` — labelled posted and deadline lines, each colored by days ago/left; with
  no deadline date it shows the deadline type + days since posted, colored like the posted line.

## Composables (`app/composables/`)

- `useListing(id)` → `{ listing, loading, error }` — client-only `listingById` query with every
  field (key `listing-${id}`), for the detail and edit pages. Also exports `ListingDetail`.
- `useListingForm()` → `{ state, validate, toInput, fill, fillDraft }` — listing form state, `UForm` validator,
  mapping to the API's `ListingInput`, `fill(listing: ListingDetail)` to load an existing one, and
  `fillDraft(json)` to load a parsed draft (keeps only valid values, leaves `url`). Also exports `ListingLocation`, `ListingLanguage`,
  `ListingSkill` types.
- `provideNewNames()` → `{ checkNewNames(state) }` / `useIsNewName()` → `(lookup, name, countryCode?) => boolean`
  — the add page checks a filled form's names in one aliased query and provides the result;
  `NameCombobox` and `SkillsField` inject it to flag names the API doesn't know. No provider = nothing
  flagged. Also exports `NameLookup`.
- `useListingsList()` → `{ listings, totalCount, page, pageSize, loading, error, refresh }` —
  offset-paged (bind `page`/`pageSize`/`totalCount` to `UPagination`) `listings` query (past
  `DATE` deadlines filtered out server-side) for the
  listings list page. Page size is fixed per page load from viewport (5 below `lg`, 6-10 at `lg`+
  depending on window height). Client-only fetch (`server: false`) since it needs the session
  cookie. Also exports `ListingListItem`.

## Stores (`app/stores/`)

- `useAuthStore()` → `{ user, fetchMe, login, loginAsGuest, logout }`.

## Utils (`app/utils/`, auto-imported)

- `gql<T>(query, variables?)` — POST to `/graphql`; throws on GraphQL errors or missing data.
- `formatDate(iso)` — formats a `YYYY-MM-DD` date string as `nb-NO` medium date (`26. sep. 2026`), parsed at local
  midnight (avoids the UTC-parsing off-by-one-day bug for negative-offset zones).
- `todayIso()` — local today as `YYYY-MM-DD` (not `toISOString()`, which is UTC).
- `daysFromToday(iso)` — whole days from local today to a `YYYY-MM-DD` date; negative if past.

## Constants (`app/constants/`, import explicitly)

- `countries.ts` — `COUNTRY_CODES`, `COUNTRY_OPTIONS` (`{ label, value }`, sorted by English name).
- `listing.ts` — `*_OPTIONS` for the listing enums, `CEFR_LEVELS`, and their value types.
- `errorMessages.ts` — `ERROR_MESSAGES` for user-facing errors.
