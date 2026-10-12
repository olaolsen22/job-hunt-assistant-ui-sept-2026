# Proposal

## Why

The profile page reads like a form instead of a CV. Every bullet shows a drag handle, edit and delete
buttons, and every entry has an "Add a bullet" input. The header puts settings next to the name. One
"Edit profile" modal holds about 13 fields, and five different buttons open it. Sections also edit in
different ways: some use modals, some save inline, and some delete without asking. Closing a modal
by mistake throws away its edits without a warning. A UX review and a code review both found these
problems (2026-10-12).

## What Changes

- **Read-first page.** Entry cards show plain bullets. Each entry, skill, language and reference gets
  one actions menu (Edit / Delete) instead of separate pencil and trash buttons. Adding and editing
  happen in modals. Translation mode stays inline on the cards, as it is today.
- **Bullets move into the entry modal.** Adding, editing, reordering and deleting bullets happen in
  the Experience, Education, Certification and Project modals, and each change still saves at once.
  The modal says that bullet changes save immediately. A new entry can get bullets after its first
  save.
- **Basics is split into three.** The header's "Edit details" form covers identity, contact, personal
  details and links, under group headings. Summary and Hobbies each get their own small form. All
  three save the whole profile, so the fields a form doesn't show are sent unchanged.
- **Header.** The header shows identity, contact and links, with Edit details and Import CV as its
  actions. When Import CV is unavailable, its tooltip explains why. Content language and the
  translate toggle move to a compact "CV language" row below the header.
- **Section order.** In the right column the order becomes Skills, Languages, Hobbies,
  Certifications, then Preferences. Preferences is job-search settings, not CV content, so it goes
  last.
- **Preferences card is read-only.** Adding and removing target locations moves into the Preferences
  modal. Those changes keep saving at once, and the modal says so.
- **Languages use a modal.** Adding a language or changing its level happens in a small form.
  Removing one asks for confirmation. The card uses the shared section empty state.
- **Consistent form modals.**
  - Enter submits the form.
  - Required fields show inline errors when the user tries to save, instead of a Save button that is
    disabled without explanation.
  - Closing a modal with unsaved changes asks the user to confirm before discarding them.
  - On phones, long forms use the full screen height.
  - Delete and remove always ask for confirmation, and the icons are the same in every section.
  - Text typed into a names field (hobbies, skills, roles) but not yet added is kept when the user
    saves.
- **CV import, small fixes only.** The review is full screen on phones. Save stays reachable in the
  footer.

Out of scope:

- API changes, and new profile fields.
- A success toast for every save.
- Reworking the CV import review flow.
- Translation mode behaviour.
- Other features' modals. The shared `AppConfirmModal` stays as it is.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-profile`: These requirements change:
  - Basics editing is split into Details, Summary and Hobbies forms.
  - Bullets are edited in the entry form, not on the card.
  - Target locations are edited in the Preferences form.
  - Languages are edited in a form, and removing one asks first.
  - The page layout and section order change.
  - New requirement: shared form-modal behaviour (unsaved-change guard, inline required errors,
    Enter to save).
  - CV import review layout on phones.

## Impact

- **Page:** `app/pages/profile.vue`.
- **Profile components in `app/components/profile/`:**
  - Changed: BasicsModal (becomes the Details form), Entry, Bullets, NamesField, Section,
    PreferencesCard and PreferencesModal, LanguageList, SkillList, ReferenceList, every entry
    Modal/List, and the CvImportModal layout.
  - New: a Summary modal, a Hobbies modal and a Language modal.
- **New shared component:** a form modal in `app/components/app/`, used by about 10 profile forms.
  Profile helpers may also be added for the shared list-and-delete state.
- **Tests:** `test/unit/ProfilePage.test.ts` must be updated for the new menus and modals, and for
  queries that pick "the first component of type X".
- **Not affected:** the API contract. No new packages.
