# Reusables

Check here before writing a helper, component, or composable. Add a line when you create one;
remove it when you delete one.

## Components (`app/components/`)

- `<AppCard title?>` — `UCard` with an optional `h2` header and an `actions` slot beside it (right-aligned; the
  header shows when either is given). Default wrapper for page sections.
- `<AppMonthField v-model v-model:partial? disabled?>` — month `USelect` + year `UInputNumber`; model is `'YYYY-MM-01' | null`
  and is `null` whenever either part is empty; `partial` is true while only one part is set. Used by every dated profile entry.
- `<AppCompareBlock current? suggested? current-label? suggested-label? compare?>` — the one layout for reviewing a
  saved value against an AI suggestion or CV import: labelled "Current" then "Suggested" columns, side by side from `sm`,
  muted "Empty" for blanks. `#suggested` replaces the plain text with an editable field; `compare: false` renders only
  that slot (new item, nothing saved). Columns carry `compare-current` / `compare-suggested` test ids. Screens keep their
  own include/dismiss/remove controls. Used by `ListingsTailoredCvSuggestion`, `ProfileSkillWordingModal`,
  `ProfileSkillCleanupModal`, `ProfileCvReview` and `ProfileCvEntryReview`.
- `<AppAiCostNotice :usage?>` — says who pays for built-in AI: the app's AI key (warning), or the owner's own provider key when the default model's `keySource` is `USER` (info, with what is left of that provider's daily limit via `useLlmCallLimits`, fetched only then). Shows today's `LlmUsage` (for the default model, named by label) when given, names the default model (via `useLlmModels`) and links to `/settings` to change it. Used by `ListingsParseModal`, `ProfileCvImportModal` and `ListingsTailoredCvAiModal`.
- `<AppAiModal v-model:open title description? busy? wide? close?>` — the frame of every built-in/own-AI modal: phone fullscreen, not dismissible and Cancel disabled while `busy`, `wide` = `max-w-4xl` for in-modal reviews, `close` runs instead of closing (confirm discard). Slots: default body, `#footer-top` (apply/save errors), `#back` (far left, review Back), `#footer-info` (left, counts/problems), `#actions` (primary after Cancel; primary on top on phones). Body order in every modal: description, method tabs, inputs, cost notice, then retry confirm or error.
- `<AppAiReviewRow v-model:include? testid-prefix label? badge? note? invalid? description? current? suggested? remove-label? disabled? @remove>` — one reviewed AI suggestion (`<li>`): include tick (when `include` is bound) or change badge + note, optional Remove, current next to suggested via `AppCompareBlock`; `#suggested` for editable fields. Test ids `${prefix}-row|-include|-remove`. Used by `ProfileSkillWordingModal` and `ProfileSkillCleanupModal`.
- `<AppAiReviewEmpty icon text>` — centered muted icon above "Nothing to change". `<AppAiReviewSelectAll selected total @all @none>` — "N of M selected" with Select all / none (`review-select-all|none`).
- `<AppAiMethodTabs v-model builtin? extra? disabled?>` — "Built-in AI" then "Your own AI" (`own`); `builtin` items replace the first tab (CV import: Paste CV); `extra` adds non-AI tabs after them (cover letter: Paste a letter).
- `<AppAiOwnSteps :ai v-model:reply testid-prefix copy? copy-disabled? note? reply-help? reply-error? start-step?>` — the own-AI steps: copy prompt, prompt-load error with retry, "View prompt / copy manually", paste the reply. `#before` holds a feature's own first step (set `start-step` after it). Test ids `${prefix}-copy-prompt`, `-prompt-error`, `-json`.
- `<AppAiErrorAlert :title code? detail?>` — AI failure alert with icon, small technical detail, and the Settings link for `daily-limit-reached`; default slot for a feature action, `#description` replaces the detail.
- `<AppAiRetryConfirm :message loading? @retry>` — warning shown instead of the usual error after an AI call returned `operation-interrupted` or `result-unavailable`; its "Try again (may be charged)" button is the only way to send another attempt (`useAiRequest().needsConfirm`).
- `<AppAiLimitLink>` — "Daily limits in Settings" button for a `daily-limit-reached` AI error, placed in the error alert's `actions` slot.
- `<AppConfirmModal v-model:open title description? confirm-label? loading? disabled? color? @confirm>` — confirm
  dialog with Cancel / confirm buttons; not dismissible while `loading`; `color="error"` for bulk, undo-less deletes. The default slot is the
  body, so form modals (`<ListingsApplyModal>` etc.) wrap it too.
- `<AppFormModal v-model:open title description? save-label? loading? :state validate? @submit>` — form
  modal on `UForm`: Enter or Save submits, `validate` errors show inline and focus the first one, closing
  with `state` changed since opening asks "Discard changes?", full screen on phones. `after` slot holds
  content that saves on its own (bullets), outside the form. Used by the profile forms.
- `PHONE_FULLSCREEN_MODAL` (`constants/ui.ts`) — `UModal` content classes for full screen below `sm`.
- `<AppMarkdownEditor v-model label>` — `UTextarea` for a Markdown note with a `n / 10000` counter
  (the API's max). Send the raw string; the API stores blank as null.
- `<AppMarkdownContent source>` — renders Markdown with `marked`, sanitized by DOMPurify, in
  `prose` (Tailwind typography). Use it as `<LazyAppMarkdownContent>` so both libs load only when a
  note is shown.
- `<DashboardApiHealth>` — API health indicator on the dashboard.
- `<DashboardWidget title icon icon-class? to? loading error empty empty-text total? @retry>` — dashboard card shell:
  header with title, count badge and "View all" link; skeleton, error alert with Retry, or empty text, else the default slot.
- `<DashboardRow id title subtitle>` — one-link listing row (dashboard widgets, company positions); the default slot is the right-hand detail.
- Dashboard widgets (`<DashboardClosingSoon>`, `Interviews`, `Offers`, `Stale`, `Pipeline`, `AppliedThisWeek`, `ToAnalyze`,
  `FavoriteListings`, `FavoriteCompanies`, `LlmUsage`) — each runs its own literal query through `useAsyncData` (client-only).
- `<DashboardEditor :layout @saved @cancel>` — edit mode for the dashboard: copy of the saved layout with up/down and show/hide
  per widget, "Reset to default" (draft only), Save sends the whole list (`saveDashboardLayout`), shows the API message and keeps the edits on failure.
- `DASHBOARD_WIDGETS` (`constants/dashboard.ts`) — per `DashboardWidgetKind`: label, icon, component, `wide`. A `Record`, so a new
  kind from the API fails typecheck. `useDashboardLayout()` — `{ layout, loading, error, refresh }` for `dashboardLayout`.
- `<CompaniesFavoriteButton id favoritedAt size?>` — star toggle for a company; same optimistic behavior as the listing one.
- `<CompaniesAvoidedBadge label?>` — warning badge for an avoided company; "Avoided" on company surfaces, `label="Avoided company"` on listing ones.
- `<CompaniesNotesModal v-model:open companyId notes @saved>` — edits a company's Markdown notes; shows the API error inline.
- `<CompaniesContactList contacts editable? @edit @delete>` — contact rows (title, mailto/tel/link buttons, Markdown notes); edit/delete only when `editable`. Used on the company and listing pages.
- `<ListingsContactsField v-model>` — listing form rows for linked contacts (name, title, email, phone, link).
- `<CompaniesContactModal v-model:open companyId contact @changed>` — add (`contact: null`) or replace a contact via `addContact`/`updateContact`; API errors as toasts.
  Uses `@click.prevent.stop`, so it can sit inside a link row.
- `<ListingsNameCombobox v-model lookup placeholder? countryCode? clear? disabled?>` — debounced search over
  `companies` / `jobRoles` / `skills` / `industries` by name, or `locations` by city within `countryCode`;
  allows creating a new name; shows a "new" hint for created names and ones `useIsNewName` flags. Results are cached in `useState('name-lookups')` and filtered
  locally; clear it with `clearNuxtState('name-lookups')` after a save that can create names.
- `<ListingsForm v-model :validate submit-label cancel-to @submit>` — the listing form's fields
  and Cancel/submit buttons, shared by add and edit. `v-model` is `useListingForm().state`; the
  default slot renders above the buttons (error alert); `url-action` renders beside the Ad link
  input. The page owns mutation, confirm, errors.
- `<ListingsCompareModal v-model:open v-model:matchId listing matches loading @keep @remove>` — compares a new listing with a possible
  duplicate, one row per field (differing rows highlighted); "Compare with" select for 2+ matches; footer: Open existing,
  Keep both, Remove new one. Values side by side from `sm`, stacked with New/Existing badges below.
- `<ListingsParseModal v-model:open listingId? url? @apply(draft, url?)>` — "Analyze ad" modal with tabs: From link (only with `listingId`;
  the API reads the saved URL), Paste ad (built-in `parseListing`, error shown in the tab) and Use your own AI (copy the
  `listingParsePrompt` + ad, paste the JSON back). The ad text is shared between the last two. Emits `apply` with the
  parsed object (feed it to `fillDraft` or `mergeDraft`); can't be closed while parsing.
- `<ListingsToggleGroup v-model :options>` — button group for an optional enum; clicking the
  active option clears it. Generic over the option value type. Rule in the form: 3 or fewer options use this, more use a
  clearable `USelectMenu` (`USelect` can't go back to empty).
- `<ListingsFilterPanel :facets v-model:sort v-model:search>` — the `/listings` toolbar (search, sort, "Filters (n)",
  Favorites toggle), a removable chip per active facet + Clear all, and the facet sheet (`USlideover`, right from `md`,
  bottom on phones); edits `facets` in place.
- `<ListingsFilterCombobox v-model lookup="skills" | "locations" placeholder?>` — multi-select search over
  existing skills (by name) or locations (by id, labelled `City, Country`); no create option.
- `<ListingsLocationsField v-model>` — `{ countryCode, city }[]` repeater (country picker + city combobox).
- `<ListingsSkillProfileModal v-model:open skill listing-level @changed>` — add a listing skill (`{ id, name, profileLevel }`) to the profile
  or change its level: level select + experience/project checkboxes (already-tagged entries locked on). Refreshes `'profile'`.
- `<ListingsSkillsField v-model>` — `{ name, level, minYears?, isRequired }[]` rows (two lines on phones, column headers from `sm`) + skill search below.
- `<ListingsLanguagesField v-model>` — `{ language, level?, isRequired }[]` rows, one per language.
- `<ListingsRow listing>` — `<li>` for one `ListingListItem` in the `/listings` list: a one-line row from `lg`
  (star, title + company · role, location +N, seniority, posted, due, status, View ad), two lines from `md`, a small
  card led by the due chip on phones. The title link is stretched over the row.
- `<ListingsDueChip listing>` — compact due badge ("3 days left", "ASAP · ~12 days left", "Expired", "Likely filled");
  urgency from `utils/dueUrgency.ts`, shared with `<ListingsDates>`.
- `<ListingsFavoriteButton id favoritedAt size?>` — star toggle button (`size` `xs` default, `md` in the detail header);
  owns its optimistic state and the `setListingFavorite` mutation. Used by `<ListingsRow>` and the listing detail page.
- `<ListingsAnalyzedBadge analyzedAt>` — "Analyzed" / "To analyze" badge. Used by `<ListingsRow>`
  and the listing detail page.
- `<ListingsStatusBadge status>` — application status badge (colors in `APPLICATION_STATUS_OPTIONS`).
  Used by `<ListingsRow>` and `<ListingsApplication>`.
- `<ListingsApplication listing v-model:apply-open @changed>` — the detail page's Application card: status/archived
  badges, company application count, Record application / Record outcome buttons per status, and
  `<ListingsStatusTimeline>` + `<ListingsInterviews>`. `@changed` = refetch the listing.
- `<ListingsStatusTimeline listing @changed>` — `UTimeline` of `statusHistory` with Edit
  (`<ListingsStatusChangeModal>`) per entry and Undo (confirmed) on the newest.
- `<ListingsInterviews listing @changed>` — upcoming/past interviews as "Round N · title", add/edit
  via `<ListingsInterviewModal>`, confirmed delete.
- `<ListingsApplyModal>`, `<ListingsOutcomeModal>`, `<ListingsStatusChangeModal>`,
  `<ListingsInterviewModal>` — `v-model:open` form modals (on `<AppConfirmModal>`) that own their
  mutation and emit `changed`.
- `<ListingsDocumentPicker v-model:document-id v-model:file label documents required? help?>` — pick an uploaded
  document or a new PDF (uploaded by the caller on submit); used twice by `<ListingsApplyModal>`.
- `/profile` (`pages/profile.vue`, data from `useProfile()`) is built from `<Profile…>` components, which own their
  mutations and emit `changed` (page refetches) or `saved` (Basics/Preferences return the whole profile):
  `<ProfileSection title icon testid empty empty-message add-label full? clearable? @add @clear>` (card with a centered empty state; header
  Add when filled, `actions` slot to override; `clearable` adds a ⋮ "Clear section" when filled, and the lists re-emit `clear`),
  `<ProfileClearSectionsModal v-model:target :profile @saved>` (confirms and runs `clearProfileSections` for one
  `ProfileSectionName` or `'ALL'`, naming what is deleted and kept), `<ProfileEntry kind entry-id title subtitle? dates? bullets>` (an
  entry row with edit/delete + `<ProfileBullets kind entry-id bullets>`: add/edit/delete/drag-reorder, max 20),
  `<ProfileNamesField v-model lookup?>` (name chips; combobox with `lookup`, free text without, used for hobbies; exposes `commit()` to add typed text before saving), `<ProfileLocationField v-model:country-code v-model:city>` (country + city, city reset on country change), `<ProfileReferenceList>`/`<ProfileReferenceModal>` (drag-reorder via `moveProfileReference`), the four `…List` + `…Modal` pairs (Experience,
  Education, Certification, Project), `<ProfileSkillList>`/`<ProfileSkillModal>`, `<ProfileLanguageList>` (inline
  levels), `<ProfilePreferencesCard>` (+ target locations via `saveLocation`) and `<ProfileBasicsModal>`.
  Translations mode: the page provides `{ translating, target }` (`provideProfileTranslation`); `<ProfileBullets>` then
  renders `<ProfileBulletTranslation :bullet>` per bullet and the Summary card shows `<ProfileTranslationBlock :profile>`
  (headline + summary in the language that isn't `contentLanguage`; stale/machine badges). While translating, a sticky
  bottom bar shows bullet progress and Done; translation rows use `<ProfileRowActions>` with a confirmed delete.
- `<ListingsLocation listing>` — map-pin line of `City, Country` joined by `|`.
- `<ListingsDates listing>` — posted and deadline lines with icons (card and detail header), posted colored by days ago, deadline
  colored by days left to the server's `dueOn` (ASAP/Not stated show `due ~date`, or "likely filled" once past).

## Composables (`app/composables/`)

- `useAiRequest()` → `{ attempt(input, request), safetyCode, safetyMessage, needsConfirm, confirmRetry }` — one per AI action. `attempt` passes a `requestId` to `request`: a new one per action, the same one only when the previous attempt got no answer and `input` is unchanged. It records the `AiSafetyError` code/message of the answer; `needsConfirm` is true after `operation-interrupted` / `result-unavailable` until `confirmRetry()`. `aiSafetyCode(errors)` reads the code. Used by `useParsePrompt`, `useProfileCvImport`, `useTailoredCvDraft` and `useCoverLetterDraft`, which also return `needsConfirm`, `safetyMessage` and `confirmRetry`.
- `useProviderKeys()` → `{ keys, status, error, saving, setKey(provider, apiKey), removing, removeKey(provider) }` — Owner only; `providerKeys` under key `provider-keys`. `setKey` returns the API's message or nothing; both mutations patch the row and refresh the models, limits and usage. `useLlmCallLimits(immediate = true)` → `{ limits, status, error, refresh, execute, saving, setLimit(provider, limit | null) }` — `llmCallLimits` under key `llm-call-limits` (null = no limit, 0 = paused). Types `ProviderKey`, `LlmCallLimit`.
- `useCollectedJobProcessing(parse)` — page-local sequential runner. `start`, `retry`, `skip`, `stop`, and `invalidate` control `idle`/`running`/`paused`/`finished`/`stopped`; `accepted` holds validated raw drafts in order. `completed`, `skipped`, `unprocessed`, `currentBatch`, `total`, `error`, `errorCode` (the failed batch's `AiSafetyError` code), and `busy` support progress and recovery UI. `markPublished()` is a one-shot guard for appending drafts.

- `LISTING_COMPARE_FIELDS` fragment + `ComparedListing` type (`composables/listingCompareFields.ts`) — fields the compare modal needs.
- `CONTACT_FIELDS` fragment + `CompanyContact` type (`composables/contactFields.ts`) — contact shape for company and listing queries.
- `useListing(id)` → `{ listing, loading, error, refresh }` — client-only `listingById` query with every
  field (key `listing-${id}`), incl. application status, history, interviews and documents, for the
  detail and edit pages. Also exports `ListingDetail`.
- `useLlmModels()` → `{ models, defaultModel, status, error, refresh, label(id), modelToSend(pick), setDefault(model | null), saving }` — `llmModels` under key `llm-models`; `dedupe: 'defer'` plus `getCachedData` make every caller on a page share one request, and only `refresh()` refetches. `modelToSend` turns the default into `undefined` so the server's default applies. `setDefault` (via `useMutation`) writes the returned list and refreshes `dashboard-llm-usage`. `isUnknownModel(errors)` checks for `UnknownLlmModelError`; the parse composables refetch on it and return `unknownModel: true`.
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
- `useAiPrompt(fetchInstructions, transform?)` → `{ instructions, promptLoading, promptError, copied, loadPrompt, copyText(text), copyPrompt() }` — the own-AI prompt every AI composable uses; `transform` appends what the query can't take (cover letter notes). `AiPromptState` is what `AppAiOwnSteps` takes.
- `useAiModalState(open, { tabFor?, onOpen? })` → `{ method, tab, error, errorCode }` — the open/reset boilerplate of every AI modal: tab from the remembered method (`tabFor` maps it), error cleared on open, `errorCode` forgotten with its error; `onOpen(tab)` runs on each open (also when mounted open). `useReviewDirty(state)` → `{ dirty, mark, clear }` — whether a review changed since `mark()`, so closing asks to discard only after an edit.
- `useAiMethod()` → cookie `ai-method` (`builtin | own | null`): AI modals open on it and write it after a successful run.
- `useParsePrompt(name)` → `{ instructions, promptLoading, promptError, copied, load (toasts on failure), loadPrompt, copy(posting), parsing, parse(posting), parsingUrl, parseFromUrl(listingId), parsingNewUrl, parseNewUrl(url) }` — fetches
  `listingParsePrompt`, `listingQuickParsePrompt` or `companyParsePrompt` and copies it + `<posting>` text
  for an external AI. `parse()` runs the built-in parser (`parseListing`, FULL, QUICK or COMPANIES by `name`) and returns
  `{ result }` (the JSON reply) or `{ error }` for the caller to show; it doesn't toast. Call `load()` before the copy button is clickable (a clipboard write after an await can be refused).
- `useProfile()` → `{ profile, loading, error, refresh }` (key `profile`, client-only). Exports `PROFILE_FIELDS`
  (the fragment the full-replace mutations also select), `BULLET_FIELDS` (also used by `moveProfileBullet`), `PROFILE` and `ProfileData` / `ProfileExperience` /
  `ProfileEducation` / `ProfileCertification` / `ProfileProject` / `ProfileSkill` / `ProfileLanguage` / `ProfileBullet`.
- `useProfileCvImport()` → prompt load/copy state, `busy`, `parse(text)`, `preview(json)`, `save(selection)`; operations return `{ value }` or `{ error, stale?, apiErrors? }` for inline handling (`apiErrors` keeps each typed save error so the modal can route it; a network failure has none and warns the save is unconfirmed). `CvCandidate` and `CvSelection` are derived from GraphQL documents; parsing/preview never imports.
- `profileCvImport.ts` → `createCvDraft(candidate, profile)` (missing skill levels: saved level by trimmed, case-insensitive name, else 1, with a visible note), `selectCvTarget(entry, kind, id, profile)`, `reviewCvSelection(draft, profile)` returning typed selection, plain-language path errors and selected count. Omission preserves content; included null clears optional basics; links/hobbies replace only on explicit opt-in. Issues are `CvIssue { path, message, severity? }` (`'warning'` guides without blocking). `cvFeedback(draft, errors)` splits source warnings into field warnings (retired when edited or skipped; entry-level ones only when skipped) and Import notes; `cvPathWithin(path, prefix)`, `cvPathRenderable(path)` (the review shows a target for it), `cvSubmissionPaths` + `cvServerIssue` (route API messages past skipped rows/bullets), `cvSavedSkill(profile, name)`, `cvEntryLabel(entry)` (saved or draft entry), `CV_ISSUES` (injection key).
- `<ProfileCvImportModal v-model:open :profile :refresh-profile @saved(profile)>` — listing-style Paste CV / Use your own AI input followed by local editable `<ProfileCvReview v-model :profile :issues :notes>` (exposes `focusIssue(paths)`: opens the first match's entry and focuses it) and `<ProfileCvEntryReview>` (compact header, Edit fields disclosure); only Save import sends one atomic mutation. The footer status counts issues (warning before a Save attempt, error after) and focuses the first; Save is neutral-subtle when nothing is selected. Refreshes target options before review, supports manual entry/bullet IDs, and confirms discarding or replacing review. The caller applies the full returned profile. English-primary profiles only; Norwegian translations are preserved.
- `<ProfileCvField :path label? help? exact?>` — `UFormField` showing the `CV_ISSUES` issue for `path` (or below it, unless `exact`); without a slot it renders only while it has a message, as a focusable item/section target. `<ProfileCvSection :title :icon :path>` — review section heading with an issue count and `actions` slot. Both must render inside `<ProfileCvReview>` (or a test providing `CV_ISSUES`).
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

- `providerLabel(provider)` (`aiProviders.ts`) — display name of an AI provider id (`openai` → OpenAI), the id itself when unknown.
- `collectedJobs.ts` — `parseCollectedJobs(source)` validates full listing JSON objects by URL, preserving every field without requiring text; `prepareCollectedJobs(source)` checks authenticated URL batches (≤100), maps indexes and filters normalized repeats across batches, returns `{ rows, remaining, skipped }` only after all succeed; `collectedJobsPosting(rows)` serializes the retained complete objects as JSON (empty rows yield no payload). Exports `CollectedJob`, `PreparedJobs`.
- `collectedJobBatches.ts` — `planCollectedJobBatches(rows)` preserves full objects and input order in consecutive batches of at most 20 jobs and 12,000 compact JSON characters; throws `OversizedCollectedJobError(index)` before processing if one object cannot fit. `collectedJobBatchPosting(batch)` is the exact compact request text. `decodeCollectedJobReply(reply, expectedCount)` extracts a JSON array and accepts only the expected count of object values. Exports the two limit constants and `OversizedCollectedJobError`.

- ``graphql(`...`, [fragments])`` — gql.tada document; result/variable types inferred from the API schema
  (`app/graphql-env.d.ts`, regenerate with `pnpm gql:gen`). Use `ResultOf<typeof DOC>` for derived types.
- `gql(document, variables?)` — POST to `/graphql`; result typed from the document; throws on GraphQL errors or missing data.
- `batchDocument<Item>(source)` — untyped runtime-built doc (one alias per item); caller names each alias's type.
- `formatDate(iso)` — formats a `YYYY-MM-DD` date string as `nb-NO` medium date (`26. sep. 2026`), parsed at local
  midnight (avoids the UTC-parsing off-by-one-day bug for negative-offset zones).
- `formatLocation(location)` — one `{ city?, countryCode }` as `Oslo, Norway` (country name from `COUNTRY_OPTIONS`); used by `ListingsLocation` and the company page.
- `formatPlaces(locations)` — a company's `{ city?, countryCode }[]` as `Oslo, NO · SE`.
- `todayIso()` — local today as `YYYY-MM-DD` (not `toISOString()`, which is UTC).
- `daysAgoIso(n)` — local date `n` days back as `YYYY-MM-DD`; `localDayStartIso(n)` — UTC instant of local midnight `n` days back.
- `formatDateTime(iso)` — formats a `DateTime` instant as `nb-NO` medium date + short time, local zone.
- `toDateTimeLocal(value = now)` — a date/ISO string as local `YYYY-MM-DDTHH:mm` for
  `<input type="datetime-local">` (send back with `new Date(value).toISOString()`).
- `isHttpUrl(value)` — whether a string parses as an `http:`/`https:` URL.
- `locationInput(countryCode?, city?)` — a form's country + city as `LocationInput` (`null` without a country).
- `formatMonth(iso)` — `YYYY-MM-DD` as `nb-NO` short month + year; `formatMonthRange(start, end, openLabel?)`
  ("Mar 2020 – Present"; no `openLabel` shows just the start); `formatYears(months)` ("2.5 yrs", "<1 yr", "" for 0).
- `daysFromToday(iso)` — whole days from local today to a `YYYY-MM-DD` date; negative if past.

## Constants (`app/constants/`, import explicitly)

- `countries.ts` — `COUNTRY_CODES`, `COUNTRY_OPTIONS` (`{ label, value }`, sorted by English name).
- `listing.ts` — `*_OPTIONS` for the listing enums (`APPLICATION_STATUS_OPTIONS` also carries each
  status's badge color; `Outcome` is `OUTCOME_OPTIONS`' value type), `CEFR_LEVELS`, `SKILL_LEVELS` (`{ label: 'Level n', value: n }`), `LINK_KIND_OPTIONS` (profile link kinds with icon), and their value types.
- `errorMessages.ts` — `ERROR_MESSAGES` for user-facing errors.
