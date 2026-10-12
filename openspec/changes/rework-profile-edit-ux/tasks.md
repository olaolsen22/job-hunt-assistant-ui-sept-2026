# Tasks

## 1. Shared form modal

- [x] 1.1 Add `app/components/app/FormModal.vue`.
  - Behaviour: UForm with an `id`, a footer Save with `type="submit" form=id`, Cancel, and
    `loading`/`dirty`/`validate`/`state` props.
  - Close guard: the `v-model:open` setter opens a nested "Discard changes?" `AppConfirmModal` when
    the form is dirty, as CvImportModal does.
  - Phones: a commented `:ui` content override for full height below `sm`.
  - Verify: a new `test/unit/AppFormModal.test.ts` covers that Enter submits, invalid state shows an
    inline error with no submit, a dirty close asks before discarding, and a clean close closes
    directly.
- [x] 1.2 Change `ProfileNamesField` to use `@keydown.enter.prevent` instead of its own `<form>`,
      and expose `commit()` to add the pending text. Verify: a test types a hobby, saves without
      pressing Add, and the hobby is sent.
- [x] 1.3 Make `AppMonthField` report a half-filled state, so forms can show "Pick a month and
      year". Existing month tests must still pass. Verify: the Half-cleared month scenario test.
- [x] 1.4 Add `ui-inventory.md` and `docs/REUSABLES.md` entries for `AppFormModal` and the
      NamesField and MonthField additions.

## 2. Basics split

- [x] 2.1 Add a `profileUpdateInput(profile, overrides)` helper in `useProfile.ts` that builds the
      full `UpdateProfileInput`. Move `BasicsModal` to `AppFormModal` as the Details form:
  - group headings for Identity, Contact, Personal and Links;
  - paired rows from `sm` up;
  - no summary or hobbies fields.
    Verify: the Editing the headline test still passes, and the sent input keeps the summary and
    hobbies.
- [x] 2.2 Add `ProfileSummaryModal` and `ProfileHobbiesModal`, both using the helper, and wire the
      summary and hobbies buttons in `profile.vue` to them. Verify: tests for the Editing the summary
      and Adding hobbies scenarios check that only that form shows and that the other fields are sent
      unchanged.

## 3. Entry modals, bullets and actions menu

- [x] 3.1 Move the Experience, Education, Project, Certification, Reference and Skill modals to
      `AppFormModal`. Each gets a `validate` for its required fields and dirty tracking with a snapshot
      taken on open. Save is no longer disabled because a required field is empty. Verify: tests for
      Missing required field, Enter saves and Closing with unsaved changes on the Experience modal, and
      the existing entry tests updated.
- [x] 3.2 Give `ProfileBullets` two modes: a read-only card list (translation mode unchanged) and
      an editable mode used inside the entry modals.
  - The editable mode replaces nested forms with `keydown` handlers and adds per-action loading.
  - Esc cancels an inline edit, and delete asks for confirmation.
  - The modal says "Bullets save as you edit". In add mode it shows "You can add bullets after
    saving".
    Verify: the bullet tests are moved to the modal and cover adding, editing, deleting with confirm,
    the limit, keeping rejected text, and that a bullet stays saved after cancelling the form.
- [x] 3.3 Make the List components derive the entry being edited by id from the current props, so
      an open modal shows refetched bullets. Verify: adding a bullet in the open modal shows it in the
      modal's list.
- [x] 3.4 Replace the pencil and trash buttons with a `UDropdownMenu` actions menu in
      `ProfileEntry`, Skill rows and Reference rows, using `i-lucide-trash-2` for removal. Keep
      `data-testid`s on the menu items where possible. Reference drag reordering stays. Verify: the
      delete-with-confirm and edit tests open the menu and pass.

## 4. Languages and Preferences

- [x] 4.1 Add `ProfileLanguageModal` (language select when adding, plus a level select). Switch
      `LanguageList` to `ProfileSection` with the actions menu, and make removal ask first. Verify:
      tests for Adding a language, Changing a level, Removing a language with confirm, and All
      languages listed.
- [x] 4.2 Move adding and removing target locations into `PreferencesModal` as a "saves
      immediately" block, with removal asking first. Make `PreferencesCard` read-only. Move
      PreferencesModal to `AppFormModal`. Verify: the target-location tests run in the modal, and a
      test checks that the card has no add inputs.

## 5. Page layout and CV import

- [x] 5.1 Rework the `profile.vue` header and layout:
  - Actions are "Edit details" and Import CV, in a row under the name on phones.
  - A disabled Import CV gets a tooltip, which replaces the hint paragraph.
  - A compact CV language row holds content language and translate.
  - The side column order is Skills, Languages, Hobbies, Certifications, Preferences.
    Verify: tests for Read view, Preferences last and the Norwegian-primary tooltip. Fix
    `ProfilePage.test.ts` queries that rely on order (first `USelectMenu`, `AppMonthField`,
    `UCheckbox`, `ProfileNamesField`, single confirm) by scoping them to the open modal.
- [x] 5.2 CvImportModal: add the phone full-height content override and make the footer's buttons
      stay visible below the wrapping alert and status. Verify: `ProfileCvImportModal.test.ts` passes,
      with no behaviour change.

## 6. Checks and handoff

- [x] 6.1 Run the full `pnpm test` (shared components changed), `pnpm lint` and `pnpm typecheck`,
      then `pnpm build` and serve with `HOST=0.0.0.0 pnpm preview --port 3000` after checking
      `lsof -i :3000`. Report E2E and live UI as unverified unless the owner authorizes a visual check.
      The nested modals and phone layout especially need a visual check.
- [x] 6.2 Run `/log-progress` for `docs/STATUS.md` and update `.claude/state/work-log.md` with the
      files, the checks and a draft commit message.
