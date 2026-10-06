# Status

Updated: 2026-10-06 · Last logged commit: 2d4ec2b

## Pages

- `/` dashboard: ten widgets (closing soon, upcoming interviews, offers, stale, pipeline, applied this week, to analyze, favorited listings, favorited companies with open listings, LLM usage today) in the user's saved order, hidden ones not mounted; "Edit dashboard" (drag by grip handle, show/hide, Reset to default, Save/Cancel); `ApiHealth`; one query per widget · `/login` (auth layout, guest login)
- `/listings` — whole view (search, sort, preset, facets, page) in the URL query via `router.replace`, so back/refresh restore it; dashboard links use `?filter=`, `?status=`, `?favorites=1`; toolbar (debounced search, sort, Filters toggle with active count, Clear all) + facet panel (status, skill,
  location, posting/required language, favorites; closed by default at every width), presets (closing soon, to analyze,
  archived), offset pagination
- `/listings/add` (full form, "Paste from ad" parser) · `/listings/quick-add` (JSON batch, one aliased `createListing` per row)
- `/listings/[id]` (detail; Back returns to the last listings view, application, timeline, interviews, documents; Analyze → edit with parser open) · `/listings/[id]/edit` ("Paste from ad" merges a parse into the saved listing; `?analyze` opens the parser)
- `/companies` — list (name, industry, locations, listing/application counts), debounced search, numbered pager over cursors (walks forward to jump, stops at the last page); search and page in the URL, page size like /listings (measurePageSize); rows open `/listings?search=<name>`; star toggles a company favorite
- `/companies/add` — paste (built-in parser or copy-paste prompt) → editable preview rows (name, industry, locations) → one `createCompanies`; result cards
- `middleware/auth.global.ts` redirects to `/login` without a session

## Components (`app/components`)

- `app/`: Card, ConfirmModal, MarkdownContent, MarkdownEditor
- `companies/`: FavoriteButton
- `dashboard/`: ApiHealth, Widget (shell), Row, ClosingSoon, Interviews, Offers, Stale, Pipeline, AppliedThisWeek, ToAnalyze, FavoriteListings, FavoriteCompanies, Editor
- `listings/`: Card, Form, Dates (server `dueOn`), Location, LocationsField, LanguagesField, SkillsField, NameCombobox,
  FilterPanel (toolbar + facets), FilterCombobox,
  ToggleGroup, FavoriteButton, AnalyzedBadge, ParseModal; application: Application, ApplyModal, DocumentPicker,
  OutcomeModal (per-status labels), StatusBadge (Accepted solid + icon), StatusChangeModal, StatusTimeline, Interviews, InterviewModal

## Stores & composables

- Pinia: `stores/auth.ts`
- Composables: useDashboardLayout, useListing, useListingForm, useListingsList (presets, facets, sort, search, page ↔ URL query; `useListingsView` last list URL; runtime-built query), useMutation, useNewNames, useParsePrompt (listing, quick, company prompts)
- Utils: daysFromToday, formatDate, formatDateTime, toDateTimeLocal, todayIso, daysAgoIso, localDayStartIso, graphql (`gql`)

## API operations in use

- REST: `/api/auth/{login,guest,logout,me}`, `/api/health`, `/api/documents/…`
- Queries: DashboardLayout, Dashboard* (ClosingSoon, Interviews, Offers, Stale, Pipeline, AppliedThisWeek, ToAnalyze, FavoriteListings, FavoriteCompanies, CompanyOpenListings), Listings (built at runtime: preset + selected facet clauses, `$order`; counts as aliases), ListingById,
  Company/JobRole/Skill/Industry/CitySearch, Companies (cursor-paged), CompanyParsePrompt, SkillFilterSearch, LocationFilterSearch, NewNameCheck, ListingParsePrompt, ListingQuickParsePrompt
- Mutations: CreateListing (`previousAttempts`), QuickAddListings, CreateCompanies, UpdateListing, DeleteListing, SetListingFavorite, SetCompanyFavorite, SaveDashboardLayout,
  SetListingArchived, UploadDocument, ApplyToListing, RecordOutcome (OFFER/ACCEPTED/REJECTED/WITHDRAWN),
  UndoStatusChange (`DuplicateListingError` → link to open listing), UpdateStatusChange, Add/Update/DeleteInterview, ParseListing

## Milestones

| Milestone                                                                                           | Status                                                                             |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Auth, health, listings CRUD, lookups                                                                | Done                                                                               |
| Application tracking (apply, outcomes, timeline, interviews)                                        | Done                                                                               |
| AI parsing (built-in parser + copy-paste prompt)                                                    | Done                                                                               |
| Sync with backend 2026-10-05 (ACCEPTED, no ROLLING, dueOn, search, closing soon, previous attempts) | Done                                                                               |
| Listings filters (facets, sort, collapsible panel)                                                  | Done; toolbar rework (search, sort, collapsed panel) checked live and e2e by owner |
| Dashboard layout editing (order + visibility)                                                       | Built; live check of edit mode pending                                             |
| Dashboard widgets + company favorites                                                               | Built; live check (cost of Pipeline / Favorited companies queries), e2e pending    |
| Companies (list + bulk add with preview)                                                            | Committed; live check, e2e and visual review pending                               |
| Analyze an existing listing (parse on edit, merged)                                                 | Committed; live check pending                                                      |
| List views kept in the URL (listings, companies)                                                    | Built, uncommitted; live check pending                                             |

## Next up

- Parse queue + `onParseJobUpdated` over SSE (waiting on the backend)
- Owner: check `/companies` and `/companies/add` live (cost check on the counts, locations repeater), run `pnpm test:e2e`, review on phone, archive `add-companies`
- Owner: archive `listings-filters` and `rework-listings-filters-layout`
- Owner: check Analyze / "Paste from ad" on an existing listing live, archive `analyze-existing-listing`
- Owner: check `list-view-in-url` live (filter → open listing → back / Back button; companies page 2 → row → back), commit, archive

## Decisions log

- 2026-10-06 — Analyzing an existing listing merges into the edit form (parsed values win, saved ones kept where the parse is empty, URL kept); saved only on "Save changes".
- 2026-10-06 — Dashboard groups removed: with a user-chosen order they can't hold, so it is one 2-column grid (Pipeline full row). An odd gap beside Pipeline is the user's choice, not handled.
- 2026-10-06 — Dashboard: stale = Saved, no dated deadline, posted 14-45 days ago (no expiry clause); interviews = Interviewing only; stale links to `?status=SAVED` (no age facet).
- 2026-10-06 — Dashboard widgets use literal documents with scalar variables (no runtime builder); only a whole `ListingFilterInput` variable fails the cost check.
- 2026-10-05 — Listings query built at runtime from fixed clauses: a `ListingFilterInput` variable fails the API cost check (HC0047).
- 2026-10-05 — Picking statuses lifts the past-deadline exclusion; the "active applications" preset is gone.
- 2026-10-05 — Due date comes from the server (`dueOn`); the UI no longer encodes ASAP + 14.
- 2026-10-05 — Legacy parsed `ROLLING` maps to `ASAP` in the form and quick-add.
- 2026-10-06 — `createCompanies` is all-or-nothing and its errors have no row, so a failed save shows one banner and keeps every row.
- 2026-10-06 — List views live in the URL query (`router.replace`), not Pinia or keepalive; listing Back uses `useState` for the last list URL.
- 2026-10-06 — Companies list: numbered pager built on per-page cursors (`first` capped at 50, no skip); jumping ahead walks page by page.
- 2026-10-05 — Accepted looks like Offer (success) but solid with an icon; no new color.
- 2026-10-06 — Filter facets live in a panel closed by default at every width; search, sort and Clear all stay in the toolbar.
