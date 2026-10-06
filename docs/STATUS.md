# Status

Updated: 2026-10-06 · Last logged commit: d5a5b56 (+ uncommitted: listings-filters, add-companies)

## Pages

- `/` dashboard (`ApiHealth`) · `/login` (auth layout, guest login)
- `/listings` — presets (closing soon, to analyze, archived) + facets (favorites, status, skill, location, posting/required
  language; collapsed below `md`), sort (due date, newest, recently changed), debounced search, offset pagination
- `/listings/add` (full form, "Paste from ad" parser) · `/listings/quick-add` (JSON batch, one aliased `createListing` per row)
- `/listings/[id]` (detail, application, timeline, interviews, documents) · `/listings/[id]/edit`
- `/companies` — list (name, industry, locations, listing/application counts), debounced search, numbered pager over cursors (walks forward to jump), page size like /listings (measurePageSize); rows open `/listings?search=<name>`
- `/companies/add` — paste (built-in parser or copy-paste prompt) → editable preview rows (name, industry, locations) → one `createCompanies`; result cards
- `middleware/auth.global.ts` redirects to `/login` without a session

## Components (`app/components`)

- `app/`: Card, ConfirmModal, MarkdownContent, MarkdownEditor
- `dashboard/`: ApiHealth
- `listings/`: Card, Form, Dates (server `dueOn`), Location, LocationsField, LanguagesField, SkillsField, NameCombobox,
  FilterPanel, FilterCombobox,
  ToggleGroup, FavoriteButton, AnalyzedBadge, ParseModal; application: Application, ApplyModal, DocumentPicker,
  OutcomeModal (per-status labels), StatusBadge (Accepted solid + icon), StatusChangeModal, StatusTimeline, Interviews, InterviewModal

## Stores & composables

- Pinia: `stores/auth.ts`
- Composables: useListing, useListingForm, useListingsList (presets, facets, sort, search seeded from `?search=`; runtime-built query), useMutation, useNewNames, useParsePrompt (listing, quick, company prompts)
- Utils: daysFromToday, formatDate, formatDateTime, toDateTimeLocal, todayIso, graphql (`gql`)

## API operations in use

- REST: `/api/auth/{login,guest,logout,me}`, `/api/health`, `/api/documents/…`
- Queries: Listings (built at runtime: preset + selected facet clauses, `$order`; counts as aliases), ListingById,
  Company/JobRole/Skill/Industry/CitySearch, Companies (cursor-paged), CompanyParsePrompt, SkillFilterSearch, LocationFilterSearch, NewNameCheck, ListingParsePrompt, ListingQuickParsePrompt
- Mutations: CreateListing (`previousAttempts`), QuickAddListings, CreateCompanies, UpdateListing, DeleteListing, SetListingFavorite,
  SetListingArchived, UploadDocument, ApplyToListing, RecordOutcome (OFFER/ACCEPTED/REJECTED/WITHDRAWN),
  UndoStatusChange (`DuplicateListingError` → link to open listing), UpdateStatusChange, Add/Update/DeleteInterview, ParseListing

## Milestones

| Milestone                                                                                           | Status                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Auth, health, listings CRUD, lookups                                                                | Done                                                          |
| Application tracking (apply, outcomes, timeline, interviews)                                        | Done                                                          |
| AI parsing (built-in parser + copy-paste prompt)                                                    | Done                                                          |
| Sync with backend 2026-10-05 (ACCEPTED, no ROLLING, dueOn, search, closing soon, previous attempts) | Done                                                          |
| Listings filters (facets, sort, collapsible panel)                                                  | Built, uncommitted; live check, e2e and visual review pending |
| Companies (list + bulk add with preview)                                                            | Built, uncommitted; live check, e2e and visual review pending |

## Next up

- Parse queue + `onParseJobUpdated` over SSE (waiting on the backend)
- Owner: check `/companies` and `/companies/add` live (cost check on the counts, locations repeater), run `pnpm test:e2e`, review on phone, commit (commit `listings-filters` first: both touch `useListingsList.ts`), archive `add-companies`
- Owner: check `/listings` filters live, run `pnpm test:e2e`, review the panel on phone/tablet, commit, archive `listings-filters`

## Decisions log

- 2026-10-05 — Listings query built at runtime from fixed clauses: a `ListingFilterInput` variable fails the API cost check (HC0047).
- 2026-10-05 — Picking statuses lifts the past-deadline exclusion; the "active applications" preset is gone.
- 2026-10-05 — Due date comes from the server (`dueOn`); the UI no longer encodes ASAP + 14.
- 2026-10-05 — Legacy parsed `ROLLING` maps to `ASAP` in the form and quick-add.
- 2026-10-06 — `createCompanies` is all-or-nothing and its errors have no row, so a failed save shows one banner and keeps every row.
- 2026-10-06 — Companies list: numbered pager built on per-page cursors (`first` capped at 50, no skip); jumping ahead walks page by page.
- 2026-10-05 — Accepted looks like Offer (success) but solid with an icon; no new color.
