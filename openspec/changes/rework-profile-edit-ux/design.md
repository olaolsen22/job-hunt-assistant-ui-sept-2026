# Design

## Context

The profile forms share a structure:

- Every profile form uses `AppConfirmModal`, which has no `<form>`. Its Save button is disabled until
  the required fields are filled.
- Each modal resets its fields in `watch(open)` and runs its save through `useMutation`. The
  mutation shows a toast on error.
- `AppConfirmModal` is also used by about 20 listing and company files, so it stays unchanged.

Inline editing lives on several cards:

- `ProfileBullets`, inside `ProfileEntry`, renders a drag list, edit and delete buttons per bullet,
  and an add form, all on the card. In translation mode it renders read-only originals with
  `ProfileBulletTranslation`.
- `PreferencesCard` has an inline form for adding target locations.
- `LanguageList` saves a new level as soon as the select changes.

Other relevant parts:

- `CvImportModal` already guards closing with a computed `v-model` setter and a "Discard?"
  `AppConfirmModal`. The new form modal copies that pattern.
- `NamesField` and `Bullets` each render their own `<form>`. Inside a form modal they would become
  nested forms.

## Goals / Non-Goals

**Goals:**

- A read-first CV page.
- One consistent form-modal behaviour: Enter saves, required fields show inline errors, unsaved
  changes are guarded, and forms are full height on phones.
- Bullets and target locations are edited inside their modals.
- Basics is split into Details, Summary and Hobbies forms.

**Non-Goals:**

- API changes.
- A success toast on every save.
- Changes to translation mode.
- A CV import redesign.
- Changing `AppConfirmModal` or modals outside the profile.

## Decisions

1. **New `AppFormModal` (`app/components/app/FormModal.vue`)**
   - **Props:** `title`, `description?`, `loading`, `dirty`, `saveLabel = 'Save'`, `validate`
     (passed to UForm), and `state`.
   - **Body:** a `UForm` with an `id`. The footer's Save is `type="submit"` with
     `form="<id>"`, so Enter in any field submits.
   - **Errors:** UForm `validate` gives inline `UFormField` errors and focuses the first invalid
     field. This replaces the disabled Save.
   - **Close guard:** the `v-model:open` setter checks `dirty`. If the form is dirty, it opens a
     nested `AppConfirmModal` ("Discard changes?") instead of closing. This is the same as
     CvImportModal. It is not dismissible while `loading`.
   - **Phones:** a `:ui` content override makes it full height below `sm`, so the body scrolls and
     the footer stays visible. The template gets a comment explaining the override.
   - **Dirty tracking:** each modal snapshots its state on open (`JSON.stringify`) and compares it
     against the current state. This is small and local, so it does not need a composable.
   - **Why a new component:** it has about 10 profile uses. It also avoids changing
     `AppConfirmModal`'s 20 other callers.
   - **Alternative considered:** adding props to `AppConfirmModal`. Rejected because it would mix
     plain confirms and forms in one component.

2. **Basics split.**
   - `BasicsModal` becomes the Details form, with "Identity / Contact / Personal / Links" headings
     (`USeparator` with a label, or small `h3`s). Pairs share a row from `sm` up.
   - New `SummaryModal` and `HobbiesModal`.
   - A helper `profileUpdateInput(profile, overrides)` in `useProfile.ts` builds the full
     `UpdateProfileInput` from the current profile. Each of the three forms overrides only its own
     fields, which keeps the "send every field" contract.
   - The Edit summary and Add/Edit hobbies buttons open their own modal.

3. **Bullets in the entry modal.**
   - `ProfileBullets` gets an `editable` mode, used inside the entry modals.
   - The card renders the bullet list plainly. In translation mode it keeps today's
     `BulletTranslation` rendering.
   - Bullet mutations still save immediately and emit `changed`. The modal shows "Bullets save as
     you edit" above the list.
   - The List components keep `editingId` and derive the entry from the current props
     (`computed(() => list.find(...))`). Otherwise, after a refetch the open modal would show stale
     bullets.
   - In add mode the modal shows "You can add bullets after saving." The modal does not reopen
     automatically after an add (keeps it simple).
   - Adding or editing a bullet uses `@keydown.enter.prevent` instead of a nested `<form>`.
   - Delete asks first through `AppConfirmModal`.
   - Each action gets its own loading state, so deleting no longer spins the add button.
   - Escape cancels an inline bullet edit, using `@keydown.esc.stop` so the modal stays open.
   - The bullet changes do not count toward the modal's `dirty` check, because they are already
     saved.

4. **Entry actions menu.**
   - `ProfileEntry`, `SkillList`, `ReferenceList` and `LanguageList` rows use one `UDropdownMenu`
     (`i-lucide-ellipsis-vertical`, labelled "Actions for <name>") with Edit and Delete/Remove
     items.
   - The menu items carry the existing `data-testid`s `profile-entry-edit` and
     `profile-entry-delete`, where Nuxt UI allows it. Otherwise the tests open the menu first.
   - Remove/delete always uses `i-lucide-trash-2`.
   - Reference drag reordering stays on the card, since it is the only way to order references.

5. **Languages.**
   - New `LanguageModal` (language select only when adding, plus a level select).
   - The card switches to `ProfileSection`, so it gets the standard empty state and Add.
   - Removing asks first.

6. **Preferences.**
   - The target-location add and remove UI moves from `PreferencesCard` into `PreferencesModal`.
     It sits in a "Target locations — saves immediately" block, with the same mutation, and
     removing asks for confirmation.
   - The card becomes read-only.
   - The custom `grid-cols-[1fr_6rem]` is replaced by Tailwind defaults where possible.

7. **Header and layout (`profile.vue`).**
   - Identity, contact and links stay at the top, with actions "Edit details" (pencil) and
     Import CV.
   - On phones the actions sit in a row under the name instead of a column beside it.
   - When Import CV is disabled, a `UTooltip` explains why, replacing the hint paragraph. The
     disabled button sits inside a `span` so the tooltip still triggers.
   - Content language, its hint and the translate toggle move to a compact row under the header.
   - Side column order: Skills, Languages, Hobbies, Certifications, Preferences.
   - The two-column structure stays. Reordering only within each column is enough and avoids
     `order-*` tricks.

8. **NamesField pending text.**
   - Use `@keydown.enter.prevent` instead of a nested `<form>`.
   - Expose a `commit()` (via `defineExpose`) that adds the pending typed text. Modals call it
     before building their input.
   - **Alternative considered:** warning about pending text. Rejected because committing it is what
     the user expects.

9. **Required fields.**
   - Entry modals and the Reference and Language modals return `{ name, message }` errors from
     `validate`.
   - A half-filled `AppMonthField` (null value while one part is set) gets the "Pick a month and
     year" error. To tell this apart from an empty field, `AppMonthField` emits or exposes a
     `partial` flag. Its existing behaviour is unchanged.

10. **CV import.**
    - Apply the same phone full-height override to the CvImportModal content.
    - The footer gets a compact layout, so the alert and status line wrap above a non-wrapping
      button row that stays visible. Nothing else changes.

## Risks / Trade-offs

- **Two kinds of saving in one modal.** Bullets and target locations save at once, while the rest
  waits for Save. This could confuse the user. Mitigation: an explicit "saves immediately" label,
  and Cancel never undoes those changes. The spec documents this.
- **Nested modals.** The discard confirm and the bullet delete confirm open on top of a form modal.
  Nuxt UI stacks overlays, so this should work, but it needs to be checked visually.
- **More clicks.** Edit and Delete now sit behind a menu, which adds one click each. The trade is a
  readable page, as the owner chose.
- **Tests.** `ProfilePage.test.ts` relies on DOM order (the "first USelectMenu" and "first
  AppMonthField" queries) and on having one confirm button. Those queries need scoping to the open
  modal.
- **Unverified UI.** E2E and live UI checks need the owner's authorization. Until then the layout
  is unverified, apart from the build and preview.
