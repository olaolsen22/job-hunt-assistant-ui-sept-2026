# Proposal

## Why

The API now has a user profile: basics, job preferences, work history, education, certifications,
projects, skills and languages. The UI has nowhere to view or edit it. It is the base for matching
listings against the user and for writing applications later, so it needs a home first.

## What Changes

- New `/profile` page, reached from the sidebar nav and the user menu. One `profile` query loads
  everything, shown as section cards (two columns on desktop, stacked on phone):
  - Header: name, headline, email, phone, location, links. The basics are edited in a modal.
  - Summary: rendered Markdown, edited in the same Basics modal.
  - Preferences: job roles, work modes, employment types, minimum salary + currency, notice period.
    Edited in a modal. Target locations are listed in the same card, added and removed one at a time.
  - Experience, Education, Certifications, Projects: lists in API order, each item added/edited in a
    modal and deleted after a confirm. Each entry shows plain-text bullets that are added, edited,
    deleted and drag-reordered inline.
  - Skills: name, level 1–5, experience in years. Set and removed one at a time.
  - Languages: language + CEFR level. Set and removed one at a time.
- Each section card has a centered empty state with a muted icon and an "Add …" action.
- API errors show as a toast with the API's message, and the modal stays open with the user's input.
  A stale entry (`ProfileEntryNotFoundError`) triggers a refetch.
- A new month field (month select + year input) is used by every dated entry. It is sent as
  `YYYY-MM-01` and shown as a short month and year.

Out of scope:

- Matching listings against the profile, CV export, or generating applications from it.
- Importing a profile (LinkedIn, CV parsing).
- Client-side validation beyond required fields and simple counts. Lengths, URL formats and
  duplicates stay with the API.
- Reordering entries. The API sorts them and the UI keeps that order. Only bullets are reordered.
- Markdown in bullets or entry text. Bullets are plain text, and only the profile summary is Markdown.
- Adding bullets from the add-entry modal.
- Editing target locations anywhere besides this page, or changing how `/companies` shows them.
- Optimistic updates. Entry, skill and language changes refetch the profile.

## Capabilities

### New Capabilities

- `user-profile`: viewing and editing the user's profile on `/profile`, covering basics,
  preferences, target locations, the four entry lists, skills and languages.

### Modified Capabilities

None.

## Impact

- GraphQL: run `pnpm gql:gen` first (`app/graphql-env.d.ts` has no Profile types yet). New uses of
  `profile`, `updateProfile`, `updateProfilePreferences`, `add/update/deleteProfile{Experience,
Education,Certification,Project}`, `setProfileSkill`, `removeProfileSkill`, `setProfileLanguage`,
  `removeProfileLanguage`, and the existing `saveLocation`.
- New:
  - `app/pages/profile.vue`
  - `app/components/profile/*` (section and modal components)
  - `app/components/profile/Bullets.vue`
  - `app/components/app/MonthField.vue`
  - `app/utils/formatMonth.ts`
  - `app/composables/useProfile.ts`
- Changed:
  - `app/layouts/default.vue` (nav item + user menu entry)
  - `app/constants/listing.ts` (`SKILL_LEVELS` moved here from `SkillsField.vue`)
  - `app/components/app/Card.vue` (an `actions` header slot)
- Reused: `AppCard`, `AppConfirmModal`, `AppMarkdownEditor` / `AppMarkdownContent`,
  `ListingsNameCombobox` (job roles, skills, cities), `useMutation`, option constants,
  `COUNTRY_OPTIONS`, `formatLocation`.
- No new packages.
