# Status

Updated: 2026-10-05 · Last logged commit: fbd89ce (+ uncommitted: sync-with-backend-api)

## Pages

- `/` dashboard (`ApiHealth`) · `/login` (auth layout, guest login)
- `/listings` — filters (closing soon, to analyze, active applications, archived), debounced search, offset pagination
- `/listings/add` (full form, "Paste from ad" parser) · `/listings/quick-add` (JSON batch, one aliased `createListing` per row)
- `/listings/[id]` (detail, application, timeline, interviews, documents) · `/listings/[id]/edit`
- `middleware/auth.global.ts` redirects to `/login` without a session

## Components (`app/components`)

- `app/`: Card, ConfirmModal, MarkdownContent, MarkdownEditor
- `dashboard/`: ApiHealth
- `listings/`: Card, Form, Dates (server `dueOn`), Location, LocationsField, LanguagesField, SkillsField, NameCombobox,
  ToggleGroup, FavoriteButton, AnalyzedBadge, ParseModal; application: Application, ApplyModal, DocumentPicker,
  OutcomeModal (per-status labels), StatusBadge (Accepted solid + icon), StatusChangeModal, StatusTimeline, Interviews, InterviewModal

## Stores & composables

- Pinia: `stores/auth.ts`
- Composables: useListing, useListingForm, useListingsList (search, closingSoon), useMutation, useNewNames, useParsePrompt
- Utils: daysFromToday, formatDate, formatDateTime, toDateTimeLocal, todayIso, graphql (`gql`)

## API operations in use

- REST: `/api/auth/{login,guest,logout,me}`, `/api/health`, `/api/documents/…`
- Queries: Listings, ListingsToAnalyze, ListingsActive, ListingsArchived, ListingsClosingSoon (`search`, `dueWithinDays: 7`),
  ListingById, Company/JobRole/Skill/CitySearch, NewNameCheck, ListingParsePrompt, ListingQuickParsePrompt
- Mutations: CreateListing (`previousAttempts`), QuickAddListings, UpdateListing, DeleteListing, SetListingFavorite,
  SetListingArchived, UploadDocument, ApplyToListing, RecordOutcome (OFFER/ACCEPTED/REJECTED/WITHDRAWN),
  UndoStatusChange (`DuplicateListingError` → link to open listing), UpdateStatusChange, Add/Update/DeleteInterview, ParseListing

## Milestones

| Milestone                                                                                           | Status                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------ |
| Auth, health, listings CRUD, lookups                                                                | Done                           |
| Application tracking (apply, outcomes, timeline, interviews)                                        | Done                           |
| AI parsing (built-in parser + copy-paste prompt)                                                    | Done                           |
| Sync with backend 2026-10-05 (ACCEPTED, no ROLLING, dueOn, search, closing soon, previous attempts) | Done, uncommitted; e2e not run |

## Next up

- Parse queue + `onParseJobUpdated` over SSE (waiting on the backend)
- Owner: run `pnpm test:e2e`, review the new UI visually, commit, archive the OpenSpec change

## Decisions log

- 2026-10-05 — Due date comes from the server (`dueOn`); the UI no longer encodes ASAP + 14.
- 2026-10-05 — Legacy parsed `ROLLING` maps to `ASAP` in the form and quick-add.
- 2026-10-05 — Accepted looks like Offer (success) but solid with an icon; no new color.
