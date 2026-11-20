# Reusables

Check here before writing a helper, component, or composable. Add a line when you create one;
remove it when you delete one.

## Components (`app/components/`)

- `<AppCard title?>` — `UCard` with an optional `h2` header and an `actions` slot beside it (right-aligned; the
  header shows when either is given). Default wrapper for page sections.
- `<AppMonthField v-model v-model:partial? disabled?>` — month `USelect` + year `UInputNumber`; model is `'YYYY-MM-01' | null`
  and is `null` whenever either part is empty; `partial` is true while only one part is set. Used by every dated profile entry.
- `<AppCompareBlock current? suggested? current-label? suggested-label? compare? contained?>` (`contained`: side by side by the nearest `@container`, not the viewport) — the one layout for reviewing a
  saved value against an AI suggestion or CV import: labelled "Current" then "Suggested" columns, side by side from `sm`,
  muted "Empty" for blanks. `#suggested` replaces the plain text with an editable field; `compare: false` renders only
  that slot (new item, nothing saved). Columns carry `compare-current` / `compare-suggested` test ids. Screens keep their
  own include/dismiss/remove controls. Used by `ListingsTailoredCvSuggestion`, `ProfileSkillWordingModal`,
  `ProfileSkillCleanupModal`, `ProfileCvReview` and `ProfileCvEntryReview`.
- `<AppAiCostNotice :usage?>` — says who pays for built-in AI: the app's AI key (warning), or the owner's own provider key when the default model's `keySource` is `USER` (info, with what is left of that provider's daily limit via `useLlmCallLimits`, fetched only then). Shows today's `LlmUsage` (for the default model, named by label) when given, names the default model (via `useLlmModels`) and links to `/settings` to change it. Used by `ListingsParseModal`, `ProfileCvImportModal` and `ListingsTailoredCvAiModal`.
- `<AppAiModal v-model:open title description? busy? wide? close?>` — the frame of every built-in/own-AI modal: phone fullscreen, not dismissible and Cancel disabled while `busy`, `wide` = `max-w-4xl` for in-modal reviews, `close` runs instead of closing (confirm discard). Slots: default body, `#footer-top` (apply/save errors), `#back` (far left, review Back), `#footer-info` (left, counts/problems), `#actions` (primary after Cancel; primary on top on phones). Body order in every modal: description, method tabs, inputs, cost notice, then retry confirm or error.
- `<AppAiReviewRow v-model:include? testid-prefix label? badge? note? invalid? description? current? suggested? current-label? suggested-label? remove-label? disabled? @remove>` — one reviewed AI suggestion (`<li>`): include tick (when `include` is bound) or change badge + note, optional Remove, current next to suggested via `AppCompareBlock`; `#suggested` for editable fields. Test ids `${prefix}-row|-include|-remove`. Used by `ProfileSkillWordingModal`, `ProfileBulletRefinementModal`, `ProfileSkillCleanupModal` and `ListingsAnswersAiModal`.
- `<AppAiReviewEmpty icon text>` — centered muted icon above "Nothing to change". `<AppAiReviewSelectAll selected total @all @none>` — "N of M selected" with Select all / none (`review-select-all|none`).
- `<AppAiMethodTabs v-model builtin? extra? disabled?>` — "Built-in AI" then "Your own AI" (`own`); `builtin` items replace the first tab (CV import: Paste CV); `extra` adds non-AI tabs after them (cover letter: Paste a letter).
- `<AppAiOwnSteps :ai v-model:reply testid-prefix copy? copy-disabled? note? reply-help? reply-error? start-step?>` — the own-AI steps: copy prompt, prompt-load error with retry, "View prompt / copy manually", paste the reply. `#before` holds a feature's own first step (set `start-step` after it). Test ids `${prefix}-copy-prompt`, `-prompt-error`, `-json`.
- `<AppAiErrorAlert :title code? detail?>` — AI failure alert with icon, small technical detail, and the Settings link for `daily-limit-reached`; default slot for a feature action, `#description` replaces the detail.
- `<AppAiRetryConfirm :message loading? disabled? @retry>` — warning shown instead of the usual error after an AI call returned `operation-interrupted` or `result-unavailable`; its "Try again (may be charged)" button is the only way to send another attempt (`useAiRequest().needsConfirm`). `disabled` while the input that attempt needs is missing (parse modals).
- `<AppAiLimitLink>` — "Daily limits in Settings" button for a `daily-limit-reached` AI error, placed in the error alert's `actions` slot.
- `<AppConfirmModal v-model:open title description? confirm-label? loading? disabled? color? @confirm>` — confirm
  dialog with Cancel / confirm buttons; not dismissible while `loading`; `color="error"` for bulk, undo-less deletes. The default slot is the
  body, so form modals (`<ListingsApplyModal>` etc.) wrap it too.
- `<AppFormModal v-model:open title description? save-label? loading? :state validate? unsaved? @submit>` — form
  modal on `UForm`: Enter or Save submits, `validate` errors show inline and focus the first one, closing
  with `state` changed since opening (or `unsaved`, e.g. an entry form's typed bullet) asks "Discard changes?", full screen on phones. `after` slot holds
  content that saves on its own (bullets), outside the form. Used by the profile forms. Exposes
  `validate()` (inline errors + focus, returns ok) and `markClean()` for forms that save without
  closing (the application question's AI draft).
- `PHONE_FULLSCREEN_MODAL` (`constants/ui.ts`) — `UModal` content classes for full screen below `sm`.
- `<AppMarkdownEditor v-model label>` — `UTextarea` for a Markdown note with a `n / 10000` counter
  (the API's max). Send the raw string; the API stores blank as null.
- `<AppMarkdownContent source>` — renders Markdown with `marked`, sanitized by DOMPurify, in
  `prose` (Tailwind typography). Use it as `<LazyAppMarkdownContent>` so both libs load only when a
  note is shown.
- `<DashboardApiHealth state @recheck>` — API health badge (`checking | healthy | databaseDown | unreachable`) + recheck button; the dashboard page owns the `/api/health` fetch.
- `<DashboardWidget title icon icon-class? to? loading error empty empty-text total? @retry>` — dashboard card shell:
  header with title, count badge and "View all" link; skeleton, "<title> couldn't load." with Retry, or empty text, else the default slot.
- `<DashboardRow id title subtitle to?>` — one-link row (dashboard widgets, company positions, a person's listings); links to `/listings/<id>` unless `to` is given (follow-ups link people). The default slot is the right-hand detail.
- Dashboard widgets (`<DashboardClosingSoon>`, `Interviews`, `Offers`, `Stale`, `Pipeline`, `AppliedThisWeek`, `ToAnalyze`,
  `FavoriteListings`, `FavoriteCompanies`, `LlmUsage`) — each runs its own literal query through `useAsyncData` (client-only).
- `<DashboardEditor v-model:open :layout @saved>` — `USlideover` editor: copy of the saved layout (reset on each open) with drag,
  up/down buttons and show/hide per widget, Save off until changed, "Reset to default" (draft only), Save sends the whole list (`saveDashboardLayout`), shows the API message and keeps the edits on failure.
- `DASHBOARD_WIDGETS` (`constants/dashboard.ts`) — per `DashboardWidgetKind`: label, icon, component, `span?: 'full' | 2`. A `Record`, so a new
  kind from the API fails typecheck. `useDashboardLayout()` — `{ layout, loading, error, refresh }` for `dashboardLayout`.
- `<AppFavoriteButton target id favoritedAt size?>` — star toggle for a company or listing (`target`), flipped
  optimistically and rolled back on an API error; `size` `xs` default, `md` in detail headers and list rows. Test id `${target}-favorite`.
- `<CompaniesAvoidedBadge label?>` — warning badge for an avoided company; "Avoided" on company surfaces, `label="Avoided company"` on listing ones.
- `<CompaniesNotesModal v-model:open companyId notes @saved>` — edits a company's Markdown notes; shows the API error inline.
- `<CompaniesContactList contacts editable? @edit @delete>` — contact rows (name links to the person page, follow-up chip, last contacted, title, mailto/tel/link buttons, Markdown notes); edit/delete only when `editable`. Used on the company and listing pages.
- `<ContactsFollowUpChip follow-up-on>` — badge for a contact's follow-up date: "Overdue 5 d" (error), "Due today" (warning), "Due 5. nov." (neutral). Text from `followUpSummary(iso)` (`utils/followUp.ts`), also used as plain text in the dashboard widget.
- `<ContactsInteractionModal contact-id interaction v-model:open @changed>` — log (null) or edit (full replace) an interaction; blocks a future date and a follow-up before it. Refetch the contact after `changed`: its follow-up and last contact come from the latest interaction.
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
- `<ListingsFilterPanel v-model:facets v-model:search :quick-counts>` — the `/listings` filter bar: search + "Filters (n)" row, a row of seven
  quick-filter pills (Favorites, Preferred, Norway only, IT, Non-IT, English posting/mentioned; counts from `quick-counts`; one scrolling line on phones),
  a removable chip per active sheet facet (plus `companyId`, labelled by the optional `company-name` prop) + Clear all, and the grouped facet sheet
  (Status, Location, Language, Skills, Dates). Pills are outside the badge and the sheet's Clear; edits `facets` in place.
- `<CompaniesFilterPanel v-model:facets v-model:search>` — the same toolbar, chips and sheet for `/companies` (hide avoided, has contacts,
  research any/yes/no, size, industry, skill, location, work mode, working language). Query/URL logic in `utils/companiesQuery.ts`, state in `useCompaniesList(grid)`.
- `<AppFilterSheet v-model:open testid-prefix clear-disabled @clear>` — the Filters slideover both panels use (right from `md`, bottom on
  phones, decided on open; Clear filters / Done footer); facet fields in the default slot.
- `<AppFilterChips :chips testid-prefix @clear-all>` — one removable chip per `{ key, label, clear }`, then Clear all.
- `<AppFilterCombobox v-model lookup="skills" | "industries" | "locations" placeholder?>` — multi-select search over
  existing skills or industries (by name) or locations (by id, labelled `City, Country`); no create option.
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
- `<ListingsAnalyzedBadge analyzedAt>` — "Analyzed" / "To analyze" badge. Used by `<ListingsRow>`
  and the listing detail page.
- `<ListingsStatusBadge status>` — application status badge (colors in `APPLICATION_STATUS_OPTIONS`).
  Used by `<ListingsRow>` and `<ListingsApplication>`.
- `<ListingsApplication listing @changed @archive>` — the detail page's Application card: a context line per status
  ("Applied 10. nov. 2026 · 8 days ago", "Next: HR screen · … (in 7 days)", outcome by who acted), the next-step
  buttons per status (Record application / Add interview / Record outcome / Record decision / Archive listing, the
  only Record application on the page), a ⋮ menu for the current status (edit date + note, Undo via
  `useUndoStatusChange`) and `<ListingsApplicationTimeline>`. `@archive` = the page's archive toggle.
- `<ListingsApplicationTimeline listing @changed>` — one `UTimeline` (newest first, `reverse`) of status changes and
  interviews from `timelineRows()`: interviews at their scheduled time with relative time and an Upcoming badge, the
  Applied row lists sent documents, INTERVIEWING entries hidden. Per-row ⋮: edit (`<ListingsStatusChangeModal>` /
  `<ListingsInterviewModal>`), confirmed interview delete.
- `<ListingsQuestionsCard listing @changed>` — application questions (max 20), numbered in form order, with a
  "N of M answered · N over its limit" summary, one meta line (characters / limit, notes marker) and add/edit/delete via
  `<ListingsQuestionModal listing-id question remaining @changed @added(count)>` (no AI; add mode has One question with
  "Add another" or Paste several, one batched add). "Draft answers with AI" opens `<ListingsAnswersAiModal listing-id questions @changed>`:
  built-in or own AI drafts every question at once, then a ticked review (saved answer vs editable draft, fitting drafts
  ticked, over-limit untickable until trimmed, "No draft" rows) and "Save N answers"; partial failures keep failed rows
  for a retry; closing or reloading with unsaved drafts asks first.
- `<ListingsApplyModal>`, `<ListingsOutcomeModal>`, `<ListingsStatusChangeModal>`,
  `<ListingsInterviewModal>` — `v-model:open` form modals (on `<AppConfirmModal>`) that own their
  mutation and emit `changed`. OutcomeModal takes `title` + per-outcome `labels`; InterviewModal's
  `moves-to-interviewing` says (and toasts) that the first interview moves Applied to Interviewing.
- `<ListingsDocumentPicker v-model:document-id v-model:file v-model:base-cv-version-id? label documents required? help? base-cvs?>`
  — pick an uploaded document or a new PDF (uploaded by the caller on submit); `base-cvs` (the CV picker) also offers
  a CV template and version, which the caller turns into a document on submit (`GENERATE_BASE_CV_DOCUMENT`) and keeps
  for a retry. Used twice by `<ListingsApplyModal>`.
- `<CvContentEditor v-model:cv v-model:flagged? :flag-language? :source disabled? :ai? skills-modal? columns?>` (`#aside-start` slot) — the CV's content cards (contact, summary, entries, skills,
  languages) and their edit modals, applied to `cv` in place. Shared by the tailored CV page, which passes `ai`
  (`CvEditorAi`: suggestion and AI-run bindings) and `skills-modal` (skills listed, edited in
  `<ListingsTailoredCvSkillsModal>`), and the CV template editor, which shows inline `<CvSkillRows v-model:skills
section-order disabled? @remove @group>` (reorder, remove, Developer category/group). `columns` (tailored CV): two
  columns from 2xl (main: contact, summary, experience, projects; side: `#aside-start`, skills, education,
  certifications, languages); without it the slot renders above the single column. `flagged` content paths
  (a translated template) show as "Still in English" badges on their cards (`data-flagged` for scrolling) and clear
  when that card's edit applies. `source` is the API's prefill in the CV's language (`tailoredCvDraftFromProfile` or
  `baseCvFromProfile`), which the Add menus offer back.
- `<CvStyleFields v-model:cv disabled?>` (two grid cells: CV style, entry format), `<CvPdfLayoutField v-model:cv disabled?>`,
  `<CvPdfLatestRow pdf current older-than testid-prefix @preview @delete>` — shared by the tailored CV, cover letter and
  CV template editors. `<AppSaveBar status status-testid changed warn align?>` — the editors' sticky bottom bar; buttons in the default
  slot, `#status` beside the status, `#above` over it.
- `<ListingsPossibleDuplicates matches disabled? testid-prefix @compare @keep @remove>` — the Possible duplicate alert, in quick add's
  review rows and `<ListingsDuplicateNotice listing-id>` on the listing page (reads `usePossibleDuplicates()`).
- `<ListingsDescriptionText text lang? clamp?>` — a listing summary paragraph; `clamp` adds 12 lines + Show full description
  (re-measured on resize and text change). `<ListingsDescriptionSwitch v-model posting-language>` — English / ad-language
  tabs. Both driven by `useDescriptionView(listing)` → `{ view, hasOriginal, text, lang }` on the listing pages.
- `<ListingsTailoredCvPdfModal v-model:open url file-name applicable?>` — previews any same-origin PDF: a document
  (`/api/documents/<id>`) or a CV template version (`baseCvPdfUrl(versionId)`). `file-name` is the label; Download / Save use the server's Content-Disposition name.
- Tailored CV page pieces: `<ListingsTailoredCvSettings v-model:cv disabled? resetting? @rebuild>` (summary line +
  settings slideover; language only offers a rebuild; default slot for rows under the summary),
  `<ListingsTailoredCvReviewBar count @accept-all @discard-all>` (sticky bar while AI changes wait: position,
  Previous/Next in page order), `<ListingsTailoredCvDiff diff>` (a `SuggestionDiff` with Reworded/New/Removed/Added
  badges). `<ListingsTailoredCvSuggestion review? diff?>`: with `review` the diff and Keep current / Accept;
  `CvSuggestionView.replaces` makes a section or entry hide its content behind the suggestion.
- Cover letter page pieces: `<ListingsCoverLetterDetails v-model:letter v-model:open? disabled? resetting? @reset-header>`
  (summary line "English · To X · date" + details slideover: language, sender, date, recipient; default slot for the
  latest PDF row), `<ListingsCoverLetterReviewBar @use @discard>` (sticky bar while a new letter waits),
  `<ListingsCoverLetterText letter name?>` (a letter's text read only), `<ListingsCoverLetterModal v-model:open editor
listing-id paste?>` (notes + relocation weeks, Built-in / Own AI / Paste tabs). Utils: `withCoverLetterBody(letter,
body)` (copies subject, greeting, paragraphs, closing), `hasCoverLetterBody`.
- `<CvTemplatesDetailsModal v-model:open base-cv? @saved>` creates a CV template (prefilled from
  `baseCvFromProfile(language)`, then opens its editor; started as an AI draft, it goes to `/cv-templates/new` and creates nothing) or renames one; `<CvTemplatesDeleteModal v-model:open base-cv
@deleted @archived>` offers Archive instead once the API says the template is in use.
- `<CvTemplatesAiDraftModal v-model:open editor>` — the own-AI draft of a template's current language: target role, notes and CV style build the prompt ("Create prompt"; a changed detail needs "Update prompt", the pasted reply stays), the reply goes through `previewBaseCv` and into `editor.replaceContent`, unsaved. Test ids `cv-ai-draft-*`.
- `/profile` (`pages/profile.vue`, data from `useProfile()`) is built from `<Profile…>` components, which own their
  mutations and emit `changed` (page refetches) or `saved` (Basics/Preferences return the whole profile):
  `<ProfileSection title icon testid empty empty-message add-label full? clearable? count? menu-items? @add @clear>` (always-open card
  styled like `TailoredCvSection`, one-line empty state with Add; header Add when filled, `actions` slot to override; ⋮ lists
  `menuItems` then "Clear section…" when `clearable` and filled, and the lists re-emit `clear`; injects `PROFILE_TRANSLATION_KEY`
  optionally and hides every action while translating),
  `<ProfileSettings v-model:translating content-language target progress stale-count has-translations loading? @change-language @translate-ai>`
  (language strip: written/translated `UTabs` with a to-do badge, progress line, "Change settings" slideover with the
  written language, and in the translated view a progress bar + Translate with AI),
  `<ProfileClearSectionsModal v-model:target :profile @saved>` (confirms and runs `clearProfileSections` for one
  `ProfileSectionName` or `'ALL'`, naming what is deleted and kept), `<ProfileEntry kind entry-id title subtitle? dates? bullets>` (an
  entry row with edit/delete + `<ProfileBullets kind entry-id bullets>`: add/edit/delete/drag-reorder, max 20),
  `<ProfileNamesField v-model lookup?>` (name chips; combobox with `lookup`, free text without, used for hobbies; exposes `commit()` to add typed text before saving), `<ProfileProjectKindSelect v-model>` (nullable project type; clearable USelectMenu, placeholder "Not specified"), `<ProfileLocationField v-model:country-code v-model:city>` (country + city, city reset on country change), `<ProfileReferenceList>`/`<ProfileReferenceModal>` (drag-reorder via `moveProfileReference`), the four `…List` + `…Modal` pairs (Experience,
  Education, Certification, Project), `<ProfileSkillList>`/`<ProfileSkillModal>`, `<ProfileLanguageList>` (inline
  levels), `<ProfilePreferencesCard>` (+ target locations via `saveLocation`) and `<ProfileBasicsModal>`.
  Translated view (`?lang=<target>` on `/profile`): the page provides `{ translating, target, … }` (`provideProfileTranslation`); `<ProfileBullets>` then
  renders `<ProfileBulletTranslation :bullet>` per bullet, Experience/Education lists put `<ProfileEntryTranslation :experience|:education>` in Entry's `#translation` slot, and the Summary card shows `<ProfileTranslationBlock :profile>`
  (headline + summary in the language that isn't `contentLanguage`; stale/machine badges). While translating, the written
  text is read only: sections hide their actions and Entry/Language/Reference rows their ⋮ (and reference drag); translation
  rows keep their own `<ProfileRowActions>` with a confirmed delete.
- `<ListingsLocation listing>` — map-pin line of `City, Country` joined by `|`.
- `<ListingsDates listing>` — posted and deadline lines with icons (card and detail header), posted colored by days ago, deadline
  colored by days left to the server's `dueOn` (ASAP/Not stated show `due ~date`, or "likely filled" once past).
- `<SkillsTopSkills>` — `/skills` "Most requested skills" card (`topSkills`, top 10); no props, period/required-only
  in the URL query (`period`, `required`); data under the `top-skills` key — `refreshNuxtData('top-skills')` after skill merges.

## Composables (`app/composables/`)

- `useAiRequest()` → `{ attempt(input, request), run(busy, input, request, read), safetyCode, safetyMessage, needsConfirm, confirmRetry }` — one per AI action. `run` is the usual built-in call: `busy` while it runs, the first payload error as `{ error, code }`, a refetch of the models on `UnknownLlmModelError`, a network failure as `genericError(e)`, else `read(payload)` → `AiOutcome<T>` (`utils/aiOutcome.ts`: `{ value }` or `{ error, code? }`). `useAiInFlight()` (key `ai-in-flight`) counts requests still waiting, for the layout's leave guard. `attempt` passes a `requestId` to `request`: a new one per action, the same one only when the previous attempt got no answer and `input` is unchanged. It records the `AiSafetyError` code/message of the answer; `needsConfirm` is true after `operation-interrupted` / `result-unavailable` until `confirmRetry()`. `aiSafetyCode(errors)` reads the code. Used by `useParsePrompt`, `useProfileCvImport`, `useTailoredCvDraft` and `useCoverLetterDraft`, which also return `needsConfirm`, `safetyMessage` and `confirmRetry`.
- `useProviderKeys()` → `{ keys, keyFor(credentialId), status, error, refresh, saving, setKey(provider, apiKey), removing, removeKey(provider) }` — Owner only; `providerKeys(includeRetired: true)` under key `provider-keys`. `keys` is one live row per provider (placeholder when not connected), sorted by label; `keyFor` also finds retired keys (usage history). `setKey` returns the API's message or nothing; both mutations refetch the keys and refresh the models, limits and usage. `useLlmCallLimits(immediate = true)` → `{ limits, status, error, refresh, execute, saving, setLimit(provider, limit | null) }` — `llmCallLimits` under key `llm-call-limits` (null = no limit, 0 = paused; the Owner gets every supported provider). Types `ProviderKey`, `LlmCallLimit`.
- `useLlmUsage(immediate = true)` — `llmUsageToday` (model, provider, keySource, requests, tokens, shared cap) under key `dashboard-llm-usage`; type `LlmUsage`. `useLlmUsageHistory(days: Ref<number>)` — Owner only, `usageDaily(days)` under key `llm-usage-history`, refetches when `days` changes; row type `LlmUsageDay`. `useRequestCap(usage, model)` → `{ ownKey, cap, state, loading }` — today's cap for a model via `requestCap`/`capState`, fetching `llmCallLimits` only for an own key; `loading` while that limit is unknown. Used by Settings' model card, the dashboard widget and `AppAiCostNotice`.
- `useCollectedJobProcessing(parse)` — page-local sequential runner. `start`, `retry`, `skip`, `stop`, and `invalidate` control `idle`/`running`/`paused`/`finished`/`stopped`; `accepted` holds validated raw drafts in order. `completed`, `skipped`, `unprocessed`, `currentBatch`, `total`, `error`, `errorCode` (the failed batch's `AiSafetyError` code), and `busy` support progress and recovery UI. `markPublished()` is a one-shot guard for appending drafts.

- `LISTING_COMPARE_FIELDS` fragment + `ComparedListing` type (`composables/listingCompareFields.ts`) — fields the compare modal needs.
- `CONTACT_FIELDS` fragment + `CompanyContact` type (`composables/contactFields.ts`) — contact shape for company, listing and People queries; also `DELETE_CONTACT` and `INTERACTION_FIELDS` / `ContactInteraction`.
- `useCursorPages()` (`composables/useCursorPages.ts`) — numbered pages over a cursor connection: `page`, `after`, `walking`, `reset()` (same tick as a search/filter change), `remember(pageInfo)` after each fetch, `goTo(target, fetchPageInfo)` walks forward to an unknown page. Used by `/companies` and `/contacts`.
- `useListing(id)` → `{ listing, loading, error, refresh }` — client-only `listingById` query with every
  field (key `listing-${id}`), incl. kind, application status, history, interviews and documents, for the
  detail and edit pages. Usable at once and awaitable (`await useListing(id)` waits for the first load), so a
  page can start its other requests first. Also exports `ListingDetail`.
- `useLlmModels()` → `{ models, defaultModel, status, error, refresh, label(id), modelToSend(pick), setDefault(model | null), saving }` — `llmModels` under key `llm-models`; `dedupe: 'defer'` plus `getCachedData` make every caller on a page share one request, and only `refresh()` refetches. `modelToSend` turns the default into `undefined` so the server's default applies. `setDefault` (via `useMutation`) writes the returned list and refreshes `dashboard-llm-usage`. `isUnknownModel(errors)` checks for `UnknownLlmModelError`; the parse composables refetch on it and return `unknownModel: true`.
- `useMutation(onStale?)` → `{ run, loading }` — `run(async () => payload.errors)` toasts the API's
  error message (or a generic one on a network error) and resolves `true` on success; a
  `*NotFoundError` calls `onStale` to refetch.
- `useUndoStatusChange(listing, onChanged)` (`useUndoStatusChange.ts`) → `{ label, request, confirm, confirmOpen,
confirmTitle, confirmDescription, loading }` — undoes the newest status change (off while a request runs or the undone entry is still showing): outcomes at once with an Undo toast
  that re-records them, Applied/Interviewing behind a confirm; `DuplicateListingError` toasts a link to the open
  listing. The same file exports `RECORD_OUTCOME` (shared with `<ListingsOutcomeModal>`).
- `toListingInput(fields)` builds the full-replace `ListingInput` (form and quick-add rows); `emptyListing()` is its starting value. `useListingForm()` → `{ state, validate, toInput, fill, fillDraft, mergeDraft }` — listing form state (incl. `kind`, sent on
  every save since `updateListing` is a full replace), `UForm` validator,
  mapping to the API's `ListingInput`, `fill(listing: ListingDetail)` to load an existing one, and
  `fillDraft(json)` to load a parsed draft (keeps only valid values, leaves `url`), and
  `mergeDraft(json)` to merge one into a filled form (parsed values win, saved ones stay where the parse is empty). Also exports `ListingLocation`, `ListingLanguage`,
  `ListingSkill` types, `UPDATE_LISTING`, `cleanListingDraft(json)` (the draft cleaning quick-add reuses) and
  `listingBasicsErrors(values, name?)` (title/company/role, http(s) link and posting date unless UNSOLICITED, deadline date; quick-add prefixes `name` per row).
- `provideNewNames()` → `{ checkNewNames(state) }` / `useIsNewName()` → `(lookup, name, countryCode?) => boolean`
  — the add page checks a filled form's names in one aliased query and provides the result;
  `NameCombobox` and `SkillsField` inject it to flag names the API doesn't know. No provider = nothing
  flagged. Also exports `NameLookup`.
- `useAiPrompt(fetchInstructions, transform?)` → `{ instructions, promptLoading, promptError, copied, loadPrompt, copyText(text), copyPrompt(), reset() }` — the own-AI prompt every AI composable uses; `transform` appends what the query can't take (cover letter notes and relocation weeks); `reset` clears a loaded prompt once the input it was built from changes (CV template AI draft). `AiPromptState` is what `AppAiOwnSteps` takes.
- `useAiModalState(open, { tabFor?, onOpen? })` → `{ method, tab, error, errorCode, usage, refreshUsage }` — the open/reset boilerplate of every AI modal: tab from the remembered method (`tabFor` maps it), error cleared on open and on a tab switch, today's usage fetched on open, `errorCode` forgotten with its error; `onOpen(tab)` runs on each open (also when mounted open); call `refreshUsage()` after a run. `useTextRewriteReview(open, reply)` — the review step of the skill wording and translation modals: `rows` (`RewriteRow`: `current`, `text`, `include`), `included`/`blank`/`canApply`/`applicable`, `setAll`, `start(rows)`, `apply(save, done)`, `back`, `discard`, `requestClose`, `applyError`, `confirmOpen`. `useReviewDirty(state)` → `{ dirty, mark, clear }` — whether a review changed since `mark()`, so closing asks to discard only after an edit.
- `useApplicationAnswersAi(listingId)` → `{ generate, preview(json), generating, previewing, ...useAiPrompt, safety/retry }` — drafts every application answer on a listing (`generateApplicationAnswers` / `previewApplicationAnswers` / `applicationAnswerExternalPrompt`); returns `AnswerCandidate[]` (`questionId`, `answer`, `length`, `overLimit`). `useAnswerReview(questions)` — its review rows (`AnswerRow`): ticks follow whether a draft fits until the owner sets one (`toggle`, `setAll`), `included`, `selectable`, `canSave`, `pending`, `overRows`, live `numberOf`/`limitOf`, trimmed `lengthOf`/`overBy`/`fits`, and `save()` → `{ saved, failed, stale }`: one aliased `updateApplicationQuestion` batch with the live question, limit and notes, per-row `saved`/`error`.
- `useAiMethod()` → cookie `ai-method` (`builtin | own | null`): AI modals and quick-add open on it and write it after a successful run.
- `useLeaveConfirm(unsaved)` → `{ open, leave }` — a page's in-app "Leave without saving?" (route-leave guard + confirm state); `useAiLeaveGuard()` → `{ open, leave }` — used once by the default layout: any navigation to another path while a built-in AI request is in flight asks first; `navigateAfterConfirm(to)` navigates past it after a page already asked. There is no app-wide reload/close guard; `ListingsAnswersAiModal` adds its own `beforeunload` while it holds unsaved drafts.
- `useDeleteDocument(done)` → `{ target, confirmOpen, deleting, ask(pdf), confirm, isDeleted(id) }` — confirmed delete of a listing's unsent PDF; deleted ids stay hidden until the documents refetch; `done(deletedId | null)` after every attempt.
- `useBackLink({ to, label })` — a sub page's parent link, shown in the default layout's fixed navbar (arrow, then the destination's short name from `sm`; icon-only with `Back to <label>` aria-label on phones). Keyed by route path, so the next page's link survives the old page unmounting. `useBackLinkState()` is the layout's read side. Top-level sidebar pages don't call it.
- `useAppToast()` → `{ success, info, warning, error, undoable(title, onUndo, opts?) }`, each `(title, { description?, icon?, action?: { label, to?, onClick? }, id? }?)`. This is the only way to show a toast: a fixed color, icon and `TOAST_DURATION` per kind, one outline `md` action, and the id defaults to `kind:title`, so a repeated message replaces the old one. The PWA update toast is the one direct `useToast` exception. `useCopyAsText(noun)` → `{ copied, copiedKey, copy(text, key?) }` — clipboard write with an error toast; `copied` flips for 2 s and `copiedKey` holds the key passed (one of several Copy buttons in a list).
- `useDebounce(fn, ms)` — debounced `fn`, dropped on unmount (search fields). `useOpenedOnce(open)` — latch for `<LazyX v-if="opened">`: loads a modal on its first open and keeps it mounted so the close animation plays.
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

- `useListingImports.ts` — job imports (collected-jobs files the API picks up): `usePendingImportCount()` for the sidebar badge, dashboard notice and imports tab badge (refresh with `refreshNuxtData(PENDING_IMPORTS_KEY)`), `fetchListingImports`/`fetchListingImport(id)` (only the single fetch selects `content`), `useSetImportReviewed()`, `useNextImport(currentId)` (`nextImportId`, `load`; first other pending import without an error).
- `useDeleteListing()` → `{ remove(id), deleting }`; shows the API's refusal as a toast and returns whether it worked.
- `useQuickAddRows(revalidate)`, `useQuickAddPaste(rows, startsClosed)`, `useQuickAddImport(importId, rows, paste)` — the quick add page's state, one concern each.
- `useBaseCvs.ts` — CV templates (the API's base CVs; "template" in CV content is the DETAILED/CONCISE style).
  `useBaseCvEditor(id)` loads the template (the API has no single-template query, so both lists in one request,
  with both languages' latest content), edits one `language` at a time (`?lang=en|no`, `switchTo`), keeps an
  editable `cv` and `dirty`, and `save(note)` returns `{ number, language, isNew }`: versions are numbered per
  language, and unchanged content returns the latest one, so only `isNew` means a new version. `addLanguage(lang)`
  loads the API's unsaved translation as a `draft` with `flagged` paths still in the source language. `replaceContent(next)` loads an AI draft unsaved (keeps the section order and references choice; `aiDrafted` until saved, discarded or replaced). `InvalidTailoredCvDraftError` lands in `invalidContent` for the
  page's Reload from profile. `useBaseCvActions()` → `setArchived(id, bool)`, `remove(id)` → deleted | in-use |
  failed. `useNewBaseCv(language)` is the unsaved new template behind `/cv-templates/new` (`source`, `cv`, `dirty`, `aiDrafted`, `replaceContent`, `discardAiDraft`, `save(name, description)`). Also `BASE_CV_LIST`, `baseCvFromProfile(language)`, `baseCvPdfUrl(versionId)`, `languageCode` (EN/NO),
  `versionsIn`/`latestIn(versions, language)`.

## Stores (`app/stores/`)

- `useAuthStore()` → `{ user, fetchMe, login, loginAsGuest, logout }`.

## Utils (`app/utils/`, auto-imported)

- `companyResearch.ts` — `researchFromJson(d)` → `{ research, ignored }`: the research fields of an external AI's company JSON, keeping only values the API accepts (enums, http(s) URLs, mod-11 org.nr, 1800..now year, ≤500 description, ≤50 unique skills) and naming the dropped ones; `researchSummary(research)` one-line summary (empty when none); `fillEmptyResearch(form, research)` fills only the empty fields of the edit form → `{ filled, kept }`; `parseCompaniesReply(reply)` → `{ rows }` or `{ error }`; `basicsFromJson(d)` (industry + valid locations, bad country codes listed) / `fillEmptyBasics(form, basics)` (empty industry; locations only when none); `hasCompanyResearch(company)` (any research field or skill; not `researchedAt`, which an edit save leaves); `isValidOrgNumber`, `formatOrgNumber`; `CompanyResearch` (= `CompanyDetailsInput`), `ResearchForm`.
- `applicationQuestions.ts` — limits (`QUESTION_MAX`, `NOTES_MAX`, `ANSWER_MAX`, `CHAR_LIMIT_MAX`, `QUESTIONS_PER_LISTING`), `isOverLimit(answer, charLimit)`, `parseQuestionLines(text, remaining)` → `PastedQuestion[]` (`question`, `charLimit` from a trailing "(500)", `overflow` past the free slots, `error`); blank lines skipped, leading "1." dropped.
- `providerLabel(provider)` (`aiProviders.ts`) — display name of an AI provider id (`openai` → OpenAI), the id itself when unknown.
- `collectedJobs.ts` — `parseCollectedJobs(source)` validates full listing JSON objects by URL, preserving every field without requiring text; `prepareCollectedJobs(source)` checks authenticated URL batches (≤100), maps indexes and filters normalized repeats across batches, returns `{ rows, remaining, skipped }` only after all succeed; `collectedJobsPosting(rows)` serializes the retained complete objects as JSON (empty rows yield no payload). Exports `CollectedJob`, `PreparedJobs`.
- `collectedJobBatches.ts` — `planCollectedJobBatches(rows)` preserves full objects and input order in consecutive batches of at most 20 jobs (our choice) and 100,000 compact JSON characters (the API's QUICK cap); throws `OversizedCollectedJobError(index)` before processing if one object cannot fit. `collectedJobBatchPosting(batch)` is the exact compact request text. `decodeCollectedJobReply(reply, expectedCount)` extracts a JSON array and accepts only the expected count of object values. Exports the two limit constants and `OversizedCollectedJobError`.

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
- `requestCap(ownKey, usageToday, providerLimit)` / `capState(cap)` / `summarizeUsage(rows)` (`utils/llmUsage.ts`) — today's cap for the default model (shared per-model pool for all users from usage today, or the owner's provider limit on an own key) → `{ used, max, left, resetsAt, pooled }`; state `unlimited | ok | near (≥80 %) | reached | paused`; `usageDaily` rows folded per model + key into `{ own, shared }` groups with totals and `partlyPriced`. Used through `useRequestCap` and by Settings' usage card.
- `formatDateTime(iso)` — formats a `DateTime` instant as `nb-NO` medium date + short time, local zone.
- `toDateTimeLocal(value = now)` — a date/ISO string as local `YYYY-MM-DDTHH:mm` for
  `<input type="datetime-local">` (send back with `new Date(value).toISOString()`).
- `isHttpUrl(value)` — whether a string parses as an `http:`/`https:` URL.
- `locationInput(countryCode?, city?)` — a form's country + city as `LocationInput` (`null` without a country).
- `formatMonth(iso)` — `YYYY-MM-DD` as `nb-NO` short month + year; `formatMonthRange(start, end, openLabel?)`
  ("Mar 2020 – Present"; no `openLabel` shows just the start); `formatYears(months)` ("2.5 yrs", "<1 yr", "" for 0).
- `daysFromToday(iso)` — whole days from local today to a `YYYY-MM-DD` date; negative if past.
- `applicationTimeline.ts`: `statusLabel(status, previous?)` (Rejected/Withdrawn read by who acted, e.g. "Declined by
  you" after an offer), `relativeDays(instant)` ("today", "tomorrow", "in 3 days", "3 days ago"),
  `formatInstantDate(instant)`, `timelineRows(listing, now?)`, `applicationContext(listing, now?)` → `{ line,
nextInterview }`, `FINISHED_STATUSES`.
- `tailoredCv.ts` (partial): `changedCvSections(cv, next, split?)` splits an external reply into per-section and
  per-entry changes; with `split` (tailored CV), added entries and a new order are their own changes
  (`kind: 'add' | 'order'`). `orderCvEntries(cv, list, ids)` applies an order; `cvEntryName(entry)` gives the review
  label name. `missingLinks(links, source)` / `missingLanguages(languages, source)`: the profile's links (URL
  compared without protocol/`www.`/trailing slash) and languages (name, case-insensitive) a draft lacks, as copies.
- `tailoredCvDiff.ts` — `diffBullets(current, suggested)` (kept/reworded/new/removed, paired by `sourceBulletId`, then
  text), `diffChips(current, suggested, id, name)` (kept/added/removed), `suggestionDiff(key, current, suggested,
style)` → `SuggestionDiff | null` (skills, or an entry's bullets/paragraph/technologies/details; null keeps the text
  compare), type `CvSuggestionView`.

## Constants (`app/constants/`, import explicitly)

- `countries.ts` — `COUNTRY_CODES`, `COUNTRY_OPTIONS` (`{ label, value }`, sorted by English name).
- `listing.ts` — `*_OPTIONS` for the listing enums (`LISTING_KIND_OPTIONS`: the form offers Vacancy and Open invitation; Unsolicited is API-only) (`APPLICATION_STATUS_OPTIONS` also carries each
  status's badge color; `Outcome` is `OUTCOME_OPTIONS`' value type), `CEFR_LEVELS`, `SKILL_LEVELS` (`{ label: 'Level n', value: n }`), `LINK_KIND_OPTIONS` (profile link kinds with icon), `PROJECT_KIND_OPTIONS` + `projectKindLabel(kind)`, and their value types.
- `company.ts` — `COMPANY_KIND_OPTIONS`, `COMPANY_SIZE_OPTIONS` (`label` with the range for selects, short `range` for badges), `companyKindLabel(kind)`, `companySizeRange(size)`, `CompanyKind`/`CompanySize`, and the research limits `DESCRIPTION_MAX`, `SKILLS_MAX`, `FOUNDED_MIN`.
- `errorMessages.ts` — `ERROR_MESSAGES` for user-facing errors.

### Requirement maps

- `useRequirementMapQuery(listingId)` shares the saved map under `requirement-map-<id>`; null is an empty saved state.
- `useRequirementMap(listingId, profileRef)` owns the local editor: `needs`, `normalized`, `dirty`, `candidateLoaded`,
  `issues`, `countIssue`, `submitted`, `error`, `loadCandidate(content)`, `discard()`, `save()`, `remove()`, plus
  generation/preview and the existing prompt/safety state. AI operations never save; failed mutations preserve edits.
- `<ListingsRequirementMapCard :listing>` shows saved counts and review needs. `<ListingsRequirementMapAiModal
v-model:open :editor>` confirms replacing unsaved edits before running AI or previewing a reply.
- `<ListingsRequirementNeedRow v-model :profile :index :issue? @remove>` edits one need. Its
  `<ListingsRequirementEvidenceModal v-model:open :need :profile @apply>` edits a copy, caps bullets/entries
  independently at 10, preserves selection order, and applies only on Use evidence.
- `profileEntries(profile)` maps `KIND:id` to `{ kind, id, name, bullets }`; `profileBullets(profile)` resolves bullet
  labels through the same entries. Wait for a successful profile request before pruning snapshot evidence ids.
- `requirementMap.ts`: `toRequirementMapInput`, `needIssue`, `matchCounts`, `needsToReview`, `requirementMapStale`,
  `newRequirementNeed`, `allowsRequirementEvidence`, and requirement field options; types derive from GraphQL results.
