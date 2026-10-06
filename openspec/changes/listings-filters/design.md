# Design

## Context

`useListingsList.ts` has five near-identical literal queries (default, to analyze, active, archived, closing soon), each with the `ListingCounts` fragment. See proposal.md for motivation.

The owner tested the real server:

- `where: $where` (a `ListingFilterInput` variable) fails with HC0047 (cost ~7.5k > max 1000) for any value, even when omitted. The limit is the Hot Chocolate default and stays.
- A literal `where` with scalar variables nested inside it works (`status: { in: $statuses }`, `deadlineOn: { gte: $today }`).
- `in: null` and an omitted `in` variable error (HC0026); `in: []` returns zero rows. So a facet with nothing selected must leave its clause out of the query text.
- `$order` as a variable works; omitted or `null` both give the default order.

The existing lookups don't fit as is: `SkillSearch` returns names (fine for filtering by name), but `CitySearch` requires a country and returns only the city name, and `NameCombobox` lets the user create new names, which is wrong for a filter.

## Goals / Non-Goals

**Goals:**

- One query builder for every combination of preset, facets, search and sort.
- Preset counts that follow the facets, in the same request.

**Non-Goals:**

- URL or storage persistence of filters.
- A generic filter-builder abstraction. The builder knows exactly these presets and six facets.

## Decisions

**1. `buildListingsQuery(preset, facets)` builds the document at runtime.** It returns `{ document, variables }`. Each selected facet adds a fixed clause string and, if it has one, its variable declaration and value:

| Facet             | Clause                                                      | Variable                |
| ----------------- | ----------------------------------------------------------- | ----------------------- |
| Favorites         | `favoritedAt: { neq: null }`                                | none                    |
| Status            | `status: { in: $statuses }`                                 | `[ApplicationStatus!]!` |
| Skill             | `skills: { some: { skill: { name: { in: $skills } } } }`    | `[String!]!`            |
| Location          | `locations: { some: { locationId: { in: $locationIds } } }` | `[Int!]!`               |
| Posting language  | `postingLanguage: { in: $postingLanguages }`                | `[Language!]!`          |
| Required language | `languages: { some: { language: { in: $languages } } }`     | `[Language!]!`          |

The preset clause and the facet clauses join under `and: [...]`. Only variables that are used are declared, because GraphQL rejects unused ones. The item fields come from the literal `ListingListItem` fragment, appended with `print()`. The document is typed the way `batchDocument` in `app/utils/graphql.ts` is: the caller names the result (`items: ListingListItem[]`, `totalCount: number` per alias). Alternatives: a `$where` variable (rejected: HC0047); always-present clauses with match-all values (hacky, and every clause adds cost); one literal query per combination (64+ queries).

**2. Literal `where` built from the selected facets, values as scalar variables.** This is a deliberate exception to the CLAUDE.md rule that documents are literal `graphql()` strings. No literal document can express "leave this clause out", and the API's cost check rules out a filter variable. The clause strings are fixed constants and never contain user input; all values travel as variables.

**3. Presets add clause text and arguments.** Default and "to analyze" add the expiry clause `or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }]` (plus `analyzedAt: { eq: null }` for "to analyze"). "Archived" and "closing soon" add the existing `archived: true` / `dueWithinDays: 7` arguments.

**4. The status facet lifts the expiry clause.** The old "active" preset showed applications past their deadline. To keep that, the builder omits the expiry clause whenever the status facet has a value. Alternative: only exempt non-SAVED statuses from the clause (`or: [{ status: { neq: SAVED } }, …]`). Rejected because it would show expired applications in the default list too, which changes the "Default list" requirement.

**5. Counts are aliases in the same document.** `toAnalyze`, `archived` and `closingSoon` each get their preset clause plus the same facet clauses, reusing the same variables. The "active" count and preset are removed.

**6. Sort is a `$order` variable.** "Due date" omits it, so the server keeps its default order (any client `order` switches that off). The other two pass `[{ createdAt: DESC }]` and `[{ statusChangedAt: DESC }]`.

**7. State stays in `useListingsList`.** Facets are a `reactive` object next to `filter` (renamed `preset`) and `search`; the panel component takes it with `v-model`. Pinia isn't needed: it isn't shared across pages. A watcher resets `page` to 1 on any change, like the existing one for filter and search.

**8. Options.** Status and the two languages are static enums: `UInputMenu` / `USelectMenu` with `multiple`, labels from the existing constants (check `docs/REUSABLES.md` for the status and language labels before adding any). Skill and location need search, so one new `ListingsFilterCombobox` (two real uses) wraps `UInputMenu` `multiple` with a debounced lookup and no "create" option. Skills filter by name; locations by id, so a new `Locations` lookup returns `id city countryCode` with no country restriction (country-only locations show as the country).

**9. Panel.** Layout comes from the ui-ux-designer, as the first UI task. Constraint: closed by default below `md`, with an active-count on the toggle. Prefer a CSS-only approach (a toggle that is `md:hidden`, panel `hidden md:block` unless opened) over a JS media query, so SSR and hydration agree. The designer may choose differently.

**10. Panel layout (from the ui-ux-designer).** One grid between the search box and the presets row. md+: always visible, no toggle, 4 columns × 2 rows (favorites, status, skill, location / posting language, required language, sort, clear). Phone: a row with the "Filters (n)" toggle and the sort select, which stays visible; the facets show below it only when opened (`max-md:hidden` class swap, not `UCollapsible`, whose JS-driven state would fight the md+ layout). Controls: `USwitch` (favorites), `USelectMenu multiple` (status, languages), `ListingsFilterCombobox` (skill, location), `USelect` (sort), ghost `UButton` (clear all, facets only). The active count counts facets, not values. The panel and the presets row stay rendered while a facet is active, so an empty result can be cleared. Presets stay outside the panel.

## Risks / Trade-offs

- [The runtime-built document has no gql.tada inference, so a typo in a clause only shows at runtime] → A unit test pins the generated text for one combination; the clauses are few and fixed.
- [Cost grows with each selected facet and is repeated in four aliases] → Each clause costs tens, far below the 1000 limit; check the API's response once with all six facets selected.
- [The panel above the grid changes where the grid starts, and selected chips can make it taller after the page size was measured] → Page size is measured once at mount; the panel's closed/default height is what gets measured. If the pager ends up below the fold with many chips selected, accept it: page boundaries must not move.
- [Any-of skill/location/language only] → Stated in the proposal. "Has all of" would need one clause per selected value.

## Open Questions

- Whether the panel is always visible from `md` up, or also has a toggle there. The designer decides; it doesn't change the specs.
