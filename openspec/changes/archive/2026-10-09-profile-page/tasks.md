# Tasks

## 1. Prep

- [x] 1.1 UX input from `ui-ux-expert`, reuse check from `ui-controller` and plan review from `ui-reviewer` (done while proposing; folded into design.md)
- [x] 1.2 Run `pnpm gql:gen` so `app/graphql-env.d.ts` has `Profile` and the profile mutations; verify with `pnpm typecheck`
- [x] 1.3 Move `SKILL_LEVELS` from `SkillsField.vue` to `app/constants/listing.ts` and import it there; `SkillsField.test.ts` and `pnpm typecheck` pass
- [x] 1.4 Add an `actions` header slot to `AppCard` (title left, actions right, header still shown when only actions are given); existing pages render unchanged, `pnpm typecheck` passes

## 2. Shared pieces

- [x] 2.1 Add `app/utils/formatMonth.ts` with `formatMonth(iso)` (nb-NO short month + year, local parsing like `formatDate`), `formatMonthRange(start, end, openLabel?)` and `formatYears(months)` ("2.5 yrs", "1 yr", "<1 yr", empty for 0); new `formatMonth.test.ts` covers each case
- [x] 2.2 Add `app/components/app/MonthField.vue` (month `USelect` + year `UInputNumber`, `v-model` `'YYYY-MM-01' | null`, null when either part is empty, `disabled` prop); new `MonthField.test.ts`: picking both emits `2021-03-01`, clearing the year emits `null`, an initial value fills both parts
- [x] 2.3 Add `app/components/profile/NamesField.vue` (chips with labelled x + `ListingsNameCombobox` by `lookup`, add logic copied from `SkillsField.addSkill`); verify through the Preferences and Experience modal tests

## 3. Page and data

- [x] 3.1 Add `app/composables/useProfile.ts`: `PROFILE_FIELDS` fragment, `PROFILE` query (target locations `id city countryCode` only), `useAsyncData('profile', …, { server: false })`, and exported `ProfileData` / entry types via `ResultOf`; `pnpm typecheck` passes
- [x] 3.2 Add `app/components/profile/Section.vue` on `AppCard` (title, icon, empty flag, empty message, `add` event; header Add only when not empty, empty state centered with a muted icon)
- [x] 3.3 Create `app/pages/profile.vue`: `definePageMeta({ title: 'Profile' })`, the company-page layout (skeleton, generic error alert, keep mounted on refresh), the header (name, headline, contact rows, links in a new tab), and the `lg:grid-cols-3` section layout with empty states; add the Profile sidebar item and user-menu entry in `layouts/default.vue`; new `ProfilePage.test.ts`: a filled profile shows its sections and an empty profile shows the empty states

## 4. Basics and preferences

- [x] 4.1 Add `profile/BasicsModal.vue`: name, headline, email, phone, clearable country + city (city reset on country change), links rows (max 10, blank rows dropped), summary via `AppMarkdownEditor`; `updateProfile` with the full input; emit `saved` with the returned profile; clear `name-lookups`. Wire the header Edit and the Summary pencil/empty state to it, and render the summary with `LazyAppMarkdownContent`. Test in `ProfilePage.test.ts`: changing only the headline sends every other field unchanged and the header updates without a refetch
- [x] 4.2 Add `profile/PreferencesModal.vue` and the Preferences card body: job roles via `ProfileNamesField lookup="jobRoles"`, work modes and employment types via `USelectMenu multiple`, salary `UInputNumber` + 3-letter currency `UInput`, notice period 0–12; `updateProfilePreferences` with the full input; emit `saved`; clear `name-lookups`. Test: a new job role is sent in `jobRoleNames` and shown after save
- [x] 4.3 Add target locations to the Preferences card: rows with a labelled remove x and an inline country + city Add row; `saveLocation` with `isTarget: true/false`, then `refresh()` and clear `name-lookups`. Test: add sends `isTarget: true` and remove sends `isTarget: false`

## 5. Entries

- [x] 5.1 Add `profile/ExperienceModal.vue` (employer, title, start/end `AppMonthField`, Current checkbox clears and disables the end month, skills via `ProfileNamesField lookup="skills"`; add/update mutation with the entry's own fields only; emit `changed`; clear `name-lookups`) and the Experience list (title · employer, `formatMonthRange` with "Present", skill badges, labelled edit/delete, delete through `AppConfirmModal` → `deleteProfileExperience`). Test: adding sends `startMonth: 'YYYY-MM-01'`, `endMonth: null` when Current is ticked, no `description`/`highlights`, and the list refetches
- [x] 5.2 Add `profile/EducationModal.vue` and the Education list (school, degree, field, months with Current; add/update/delete). Test: delete after confirm sends `deleteProfileEducation`
- [x] 5.3 Add `profile/CertificationModal.vue` and the Certifications list (name, issuer, issued/expires months, URL link; add/update/delete); verify by `pnpm typecheck` and one look in the UI (no separate test, same pattern as 5.2)
- [x] 5.4 Add `profile/ProjectModal.vue` and the Projects list (name, URL, optional months with no "Present", skills; add/update/delete); verify by `pnpm typecheck` (same pattern as 5.1)
- [x] 5.5 Add `profile/Bullets.vue` (`kind`, `entryId`, `bullets`; plain-text rows keyed by `id`; inline edit with Save/Cancel; delete; "Add bullet" row disabled at 20; drag-to-reorder with `vue-draggable-plus` and a labelled handle, sending the final index to `moveProfileBullet` and replacing that entry's bullets with the returned list) and render it under each entry in the Experience, Education, Certifications and Projects lists. Test in `ProfilePage.test.ts`: add sends `addProfileBullet` with the right `kind` and `entryId`, edit sends `updateProfileBullet`, a drop sends `moveProfileBullet` with the final index and shows the returned order, and the 20th bullet disables Add
- [x] 5.6 Stale id: confirm that a `ProfileEntryNotFoundError` response shows its message and refetches the profile (through `useMutation`'s `onStale` → `changed`). Test once in `ProfilePage.test.ts` with an update

## 6. Skills and languages

- [x] 6.1 Add `profile/SkillModal.vue` (name via `NameCombobox lookup="skills"` when adding, read-only when editing; level `USelect` of `SKILL_LEVELS`; `setProfileSkill`; emit `changed`; clear `name-lookups`) and the Skills list (name, `Level n/5` badge, `formatYears(experienceMonths)`, labelled edit/remove; remove confirms then sends `removeProfileSkill({ skillId: skill.id })`). Test: changing a level sends `setProfileSkill` with the name and new level
- [x] 6.2 Add the Languages list: inline level `USelect` per row (calls `setProfileLanguage` on change, errors through `useMutation`'s catch since the payload has no `errors`), a labelled remove x (`removeProfileLanguage`), and an add row limited to unused languages that is hidden when none are left. Test: adding Norwegian B2 sends `setProfileLanguage` and the add row disappears when both languages exist

## 7. Wrap-up

- [x] 7.1 Update `.claude/state/ui-inventory.md` (profile page, components, `useProfile`, `AppMonthField`, `formatMonth`, `AppCard` actions slot, `SKILL_LEVELS`) and `docs/REUSABLES.md` for the new shared pieces
- [x] 7.2 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test`; all pass (E2E not run)
- [x] 7.3 `pnpm build`, then `pnpm preview --port 3000` (kill a stale preview on 3000 first); ask the owner before a live UI check, otherwise report the UI as unverified, and check the `profile` query cost against the real API once
- [x] 7.4 Run `/log-progress` to update `docs/STATUS.md`

## 8. Schema update (added after the API changed)

- [x] 8.1 Link `kind` (required), `hobbies` (required on `updateProfile`), date of birth, nationality, work authorization in the Basics modal and header; hobbies card
- [x] 8.2 Optional `location` on experience, education and project (shared `ProfileLocationField`)
- [x] 8.3 References: list, add/edit modal, confirmed delete, drag-reorder
