# Design

## Context

- **Schema:**
  - `profile: Profile!` returns everything in one query. Lists come back pre-sorted.
  - `updateProfile` and `updateProfilePreferences` are full replaces that return the full `profile`.
  - Entry mutations return only the entry (or `id` on delete). `setProfileSkill` returns the skill,
    and the language mutations return the language.
  - Entries have no free-text fields of their own. Experience, education, certification and project
    each have `bullets { id text position }`, already sorted. Entry add/update mutations never touch
    bullets.
  - Four bullet mutations are shared by all kinds: `addProfileBullet { kind, entryId, text }`,
    `updateProfileBullet { id, text }`, `moveProfileBullet { id, position }` (returns the entry's
    whole list) and `deleteProfileBullet { id }`. Text is 1–500 characters, at most 20 per entry.
    `ProfileEntryKind` is `EXPERIENCE | EDUCATION | CERTIFICATION | PROJECT`.
  - `targetLocations` is read-only on the profile and changed via `saveLocation({city, countryCode,
isTarget})`.
  - `ProfileSkill.experienceMonths` costs 10 per skill.
  - Dates are `LocalDate` (`YYYY-MM-DD`).
  - Error unions are `InvalidProfileError`, `ProfileEntryNotFoundError` and `InvalidLocationError`.
    `SetProfileLanguagePayload` has no `errors` field.
  - `ProfileSkill` has no id of its own; `removeProfileSkill` takes `skill.id`.
- **UI today:**
  - `app/graphql-env.d.ts` has no Profile types, so `pnpm gql:gen` comes first.
  - Nothing uses `saveLocation` or a month input yet.
  - Masking is off in `graphql()`, so fragments read like plain fields.
- **Agents consulted:** `ui-controller` (reuse), `ui-ux-expert` (layout) and `ui-reviewer` (plan
  check against the repo and schema). Their recommendations are folded in below.

## Goals / Non-Goals

**Goals:**

- One page and one query. Every edit happens in a modal, so the user never leaves the page.
- Reuse the company page layout, `InterviewModal`'s add/edit pattern, `useMutation`, `NameCombobox`
  and the option constants.

**Non-Goals:**

- Optimistic or hand-merged list updates. Lists come back sorted from the API, and skill years depend
  on experiences, so a refetch is the correct and simplest update. The one exception is
  `moveProfileBullet`, whose returned list replaces that entry's bullets.
- Rendering bullets as Markdown. They are plain text.
- Generalising `SkillsField` / `LanguagesField`. They edit listing-shaped arrays that are saved
  later; the profile saves one row at a time.

## Decisions

- **Data: `useProfile()` composable**
  - `useAsyncData('profile', () => gql(PROFILE), { server: false })` returns
    `{ profile, pending, error, refresh }`.
  - A `PROFILE_FIELDS` fragment on `Profile` is shared by the query and by both full-replace
    mutations. After `updateProfile` / `updateProfilePreferences` succeed, assign `payload.profile`
    to `data.value`, with no refetch.
  - Only the page calls `useProfile()`. Modals don't refetch themselves:
    - Entry, skill and language modals use `useMutation(() => emit('changed'))`, as
      `InterviewModal` does. The page calls `refresh()` on `changed`, which also covers stale ids.
    - Basics and Preferences emit `saved` with `payload.profile`, which is nullable. The page narrows
      it, then assigns it to `data.value`.
  - Target location adds and removes also call `refresh()`.
  - Query only the fields the page shows. For target locations that's `id city countryCode`, without
    `isTarget` or `listingCount` (`listingCount` costs 10 per item).
  - `ProfileData = ResultOf<typeof PROFILE>['profile']` and per-entry types come from it.
  - Alternative: Pinia. Rejected, because only this page uses the profile (CLAUDE.md: Pinia only for
    cross-page state).
- **Page layout** (`app/pages/profile.vue`)
  - Copied from `companies/[id]/index.vue`: `max-w-3xl lg:max-w-6xl`, the same skeleton and
    `UAlert` + `ERROR_MESSAGES.generic`, and refresh keeps the page mounted.
  - Header: name, headline, contact rows with `size-4` icons, and links as `target="_blank"` link
    buttons. An Edit button opens the Basics modal.
  - Grid `lg:grid-cols-3`:
    - Left (`lg:col-span-2`): Summary, Experience, Projects, Education.
    - Right: Preferences (with target locations), Skills, Languages, Certifications.
    - Below `lg` the sections stack in that order.
  - Nav: `{ label: 'Profile', icon: 'i-lucide-user-round', to: '/profile' }` as the 4th sidebar
    item, plus a Profile entry in the user dropdown.
- **`ProfileSection` shell**
  - First add an `actions` slot to `AppCard` next to its `h2` (`flex justify-between`). Today it only
    has a `title` prop.
  - `ProfileSection` is built on `AppCard`, with a title, an empty flag, an empty state (centered
    `size-10` muted icon, message, Add button) and a default slot for rows.
  - The header Add button (`size="sm"`, subtle) shows only when the section has items, so an empty
    section has one Add button, not two (like the company Notes card).
  - It has 7 uses: Experience, Projects, Education, Certifications, Skills, Languages and Summary.
  - Summary has no Add button. A pencil icon button (`aria-label="Edit summary"`) opens the Basics
    modal, and its empty state does the same.
  - Every icon-only button gets a specific `aria-label`, e.g. `Edit experience at ${employer}`,
    `Remove ${name}`, like `SkillsField`.
  - Icons:
    - experience `briefcase`, education `graduation-cap`, certifications `award`
    - projects `folder-git-2`, skills `wrench`, languages `languages`, summary `notebook-pen`
- **Modals**
  - Each modal copies `InterviewModal`: an `entry | null` prop (null = add), fields reset from the
    entry on open, and `changed` (or `saved`) emitted on success.
  - Errors go through `useMutation`'s toast; the modal stays open, so the input is kept.
    `ProfileEntryNotFoundError` refetches via `onStale`. Inline errors (the `NotesModal` style)
    were considered; the toast is the existing shared path and needs no per-modal code.
  - Modals: `BasicsModal`, `PreferencesModal`, `ExperienceModal`, `EducationModal`,
    `CertificationModal`, `ProjectModal`, `SkillModal`. Languages are edited inline (see below).
    Deletes reuse `AppConfirmModal`.
  - Entry modals edit only the entry's own fields. Bullets are not in the modals (see Bullets).
  - Long modals (experience, project) get `fullscreen` below `sm` only if they overflow on a phone.
- **Inputs**
  - **Full replace:** the Basics and Preferences modals fill from the whole profile and build the
    whole input, so no field is lost. Empty strings are sent as `null` for nullable fields.
  - **Blank rows:** blank links (both label and URL empty) are dropped from the input.
    Everything else goes to the API as typed.
  - **Location (basics):**
    - Country: a clearable `USelectMenu` (`clear`, with `COUNTRY_OPTIONS`).
    - City: `ListingsNameCombobox lookup="locations" :country-code`, disabled until a country is
      picked.
    - Changing the country resets the city.
    - The input is `{ countryCode, city: city || null }`, or `location: null` when there is no
      country.
  - **Links:** rows of `UInput`s with an x button and an "Add link" button, disabled at 10. Same row
    pattern as `LocationsField`.
  - **Names (job roles, entry skills):**
    - A new `ProfileNamesField`: chips with an x, plus `ListingsNameCombobox` (`lookup="jobRoles"`
      or `"skills"`). 3 uses.
    - The add copies `SkillsField`'s `addSkill`: a case-insensitive duplicate check, a push, then
      `nextTick` to clear the combobox.
  - **Name cache:** every save that can create a name calls `clearNuxtState('name-lookups')` after
    it succeeds, as `companies/[id]/edit.vue` does. That covers Basics (city), Preferences (job
    roles), Experience and Project (skills), Skill, and target location add.
  - **Work modes / employment types:** `USelectMenu multiple value-key="value"`, as in
    `FilterPanel.vue`. Not `ToggleGroup`, which is single-select.
  - **Salary:** `UInputNumber` (min 0) + currency `UInput` (3 chars, uppercased, placeholder "NOK").
    The API validates the ISO code and requires it with a salary. A fixed currency list was
    rejected because it would drop any code it doesn't list.
  - **Notice period:** `UInputNumber :min="0" :max="12"`.
  - **Markdown:** `AppMarkdownEditor` and `LazyAppMarkdownContent` for the profile summary only.
- **Months: `AppMonthField` + `formatMonth`**
  - `UInput type="month"` was rejected because desktop Firefox and Safari show a plain text box.
    `UInputDate` has no month-only granularity.
  - `AppMonthField`: a month `USelect` + year `UInputNumber`, `v-model` as `'YYYY-MM-01' | null`.
    Month and year live in local refs. It emits the date only when both parts are set, and `null`
    whenever either part is empty, so an old date can't survive a half-clear. A required start
    month then blocks Save.
  - `formatMonth(iso)`: `Intl.DateTimeFormat('nb-NO', { month: 'short', year: 'numeric' })`, the same
    locale as `formatDate`, with the same local-time parsing trick.
  - `formatMonthRange(start, end, openLabel)`: "start – end". When there is no end it uses
    `openLabel`: "Present" for experience and education, nothing for projects.
  - Experience and education: a "Current" `UCheckbox` clears and disables the end month.
  - Certifications: issued and expires are two independent optional months.
- **Bullets: `profile/Bullets.vue`**
  - One component for all four entry kinds (4 uses), shown under each entry row. It takes `kind`,
    `entryId` and `bullets`, and emits `changed`.
  - Rows are plain text, keyed by `bullet.id`, never by index. Each row has an edit button and a
    delete button with specific `aria-label`s. Editing is inline: the row turns into a `UInput`
    with Save and Cancel.
  - An "Add bullet" row at the end appends via `addProfileBullet`. It is disabled at 20 bullets.
    Text is trimmed and sent as typed, and the API owns the 1–500 rule.
  - Reorder uses `vue-draggable-plus` (already used by the dashboard editor) with a drag handle. On
    drop it sends the final index as `position` to `moveProfileBullet`, then replaces that entry's
    bullets with the returned list. It does not refetch.
  - Add, edit and delete refetch through `changed`. Errors use `useMutation`'s toast, and a
    `ProfileEntryNotFoundError` refetches via `onStale`.
  - New entries are saved first. The user adds bullets from the entry's card afterwards. Sending
    bullets from the add modal was rejected because a failure partway would leave a half-saved entry.
  - Bullets are edited inline rather than in the entry modals, because the entry mutations never
    touch them.
- **Skills**
  - Rows: name, a `Level n/5` subtle badge, and years as muted text.
  - Years: `months / 12` rounded to 0.5 → "2.5 yrs" / "1 yr"; "<1 yr" when 0 < months < 12;
    nothing when 0.
  - `SkillModal`: when adding, the name comes from `NameCombobox lookup="skills"`; when editing, the
    name is read-only. The level is a `USelect` of `SKILL_LEVELS`, moved from `SkillsField.vue` to
    `app/constants/listing.ts`. Both cases call `setProfileSkill` (upsert).
  - Remove: `removeProfileSkill({ skillId: skill.id })`, after a confirm.
- **Languages** (only 2 exist, so no modal)
  - Each row has the language name, an inline level `USelect` (`CEFR_LEVELS`) and a remove x.
    Changing the level calls `setProfileLanguage` right away.
  - An add row at the bottom has a language select limited to unused languages (`LanguagesField`'s
    idea), a level select and an Add button. It is hidden when no language is left.
  - `SetProfileLanguagePayload` has no `errors`, so select only `profileLanguage { language level }`
    and run it as `run(async () => { await gql(…); return null })`. A failure gets the generic toast
    from `useMutation`'s catch.
  - Remove calls `removeProfileLanguage({ language })`.
- **Target locations**
  - In the Preferences card: `formatLocation` rows with an x, plus an inline country + city row with
    an Add button. It uses the same reset-city-on-country-change rule as Basics.
  - Add calls `saveLocation({ ...loc, isTarget: true })`; remove calls the same with
    `isTarget: false`. Then `refresh()`.

## Risks / Trade-offs

- **Query cost:** `experienceMonths` and `targetLocations` add weight per item. A large profile could
  hit the cost limit. Check it once against the real API. If it fails, drop `experienceMonths` from
  the main query (backend suggestion only if it is still needed).
- **Refetch after every row change:** one extra request per save. Acceptable for a single-user page,
  and it keeps API ordering and computed years correct.
- **Full replace:** a bug that leaves a field out of the input silently clears it. Mitigation: build
  the input from one typed function per modal, and test that an untouched field is sent unchanged.
- **Month field:** two controls instead of one native input. It needs a "both or neither" rule, and
  a half-filled value is not emitted.
