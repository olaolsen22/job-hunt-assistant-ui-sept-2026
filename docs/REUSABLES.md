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
  allows creating a new name. Results are cached in `useState('name-lookups')` and filtered
  locally; clear it with `clearNuxtState('name-lookups')` after a save that can create names.
- `<ListingsToggleGroup v-model :options>` — button group for an optional enum; clicking the
  active option clears it. Generic over the option value type.
- `<ListingsLocationsField v-model>` — `{ countryCode, city }[]` repeater (country picker + city combobox).
- `<ListingsSkillsField v-model>` — skill search + `{ name, level, isRequired }[]` rows.
- `<ListingsLanguagesField v-model>` — `{ language, level?, isRequired }[]` rows, one per language.
- `<ListingsCard listing>` — plain `UCard` for one `ListingListItem`: title, company, location
  badges, posted/deadline row, "View posting" footer link.

## Composables (`app/composables/`)

- `useListingForm()` → `{ state, validate, toInput }` — listing form state, `UForm` validator, and
  mapping to the API's `ListingInput`. Also exports `ListingLocation`, `ListingLanguage`,
  `ListingSkill` types.
- `useListingsList()` → `{ listings, totalCount, hasNextPage, hasPrevPage, loading, error, nextPage,
prevPage, refresh }` — cursor-paged `listings` query (20/page) for the listings list page.
  Client-only fetch (`server: false`) since it needs the session cookie. Also exports
  `ListingListItem`.

## Stores (`app/stores/`)

- `useAuthStore()` → `{ user, fetchMe, login, loginAsGuest, logout }`.

## Utils (`app/utils/`, auto-imported)

- `gql<T>(query, variables?)` — POST to `/graphql`; throws on GraphQL errors or missing data.
- `formatDate(iso)` — formats a `YYYY-MM-DD` date string as `en-GB` medium date, parsed at local
  midnight (avoids the UTC-parsing off-by-one-day bug for negative-offset zones).

## Constants (`app/constants/`, import explicitly)

- `countries.ts` — `COUNTRY_CODES`, `COUNTRY_OPTIONS` (`{ label, value }`, sorted by English name).
- `listing.ts` — `*_OPTIONS` for the listing enums, `CEFR_LEVELS`, and their value types.
- `errorMessages.ts` — `ERROR_MESSAGES` for user-facing errors.
