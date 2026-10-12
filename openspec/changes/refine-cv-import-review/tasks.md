# Tasks

## 1. Restore a working, verified baseline

- [x] 1.1 Fix the skill-level `@update:model-value` handler in `CvReview.vue` (arrow function, `;`-separated) and update the stale duplicate-skill assertion in `profileCvImport.test.ts`. Verify that `pnpm vitest run test/unit/profileCvImport.test.ts test/unit/ProfileCvImportModal.test.ts test/unit/ProfileCvEntryReview.test.ts` loads and passes.
- [x] 1.2 Reconcile `openspec/changes/improve-cv-import-review/tasks.md`: check off only tasks whose behavior the passing tests or source confirm, and leave docs/verification tasks open for this change to complete. Verify each checked box against a test or code location.

## 2. Issue model and visibility

- [x] 2.1 Replace `CvReview`'s `errors`/`issues`/`attempted` props with one severity-tagged issue list plus `attempted`. Derive needs-attention and section counts from it, including server issues. Add `cvPathWithin` to the CV utility and use it in all four prefix checks. Move the provide/inject helpers from `useCvFeedback.ts` into the utility, dropping the inject default and the file. Remove the `contentLanguage` branch and the redundant `profile` computed. Verify with utility tests for `cvPathWithin`, and modal tests where a mapped server error marks its collapsed entry as needing attention.
- [x] 2.2 Add exact item-level `ProfileCvField`s for links, skills, languages and bullets. Move include/location/ongoing checkboxes out of field wrappers and wrap `ProfileLocationField` alone. Suppress the footer `saveError` only when every mapped issue has a rendered target. Use `focus({ preventScroll: true })`. Verify with modal tests that item-level server and warning messages are visible and focused, a missing country focuses the country picker, and an unrenderable mapped path still shows the footer alert.
- [x] 2.3 Keep entry-level source warnings until their entry is skipped, and suppress warnings only on exact error path matches. Verify with utility tests using realistic backend messages: an entry note survives a field edit and disappears on skip, and a non-missing skill-level ambiguity warning stays visible after a level default.

## 3. Compact review layout

- [x] 3.1 Rework skill and language rows as single `divide-y` rows with a named include checkbox, the name (muted when skipped), the level select and a "Saved n/5"/"New" badge using trimmed case-insensitive matching. Add Include all/Skip all for skills, and read-only previews of imported links/hobbies before Replace is ticked. Verify with component tests that a skipped skill's name stays visible, the badges render, bulk toggles update the footer count, and imported links are listed before opt-in.
- [x] 3.2 Rework `CvEntryReview`:
  - a header with title, subtitle and `formatMonthRange` dates, and the needs-attention badge and `aria-label`led action select on the right
  - an "Edit fields" `<details>`
  - a muted skipped state without a disclosure
  - no Update existing when no saved entries exist
  - one-row bullets
  - a widened `cvEntryLabel`, and "Current" as the ongoing label

  Verify with `ProfileCvEntryReview.test.ts` cases for the collapsed header, a badge visible while collapsed, a title-only experience, the skipped state, the action list without saved entries, and expand-and-edit retaining values.

- [x] 3.3 Trim the basics help to a single line under the heading, the checkbox labels to the field name and the info alert to one sentence, and add lucide icons and issue-count badges to section headings. Verify with a modal test that a section count updates after correcting an item.

## 4. Footer and Save

- [x] 4.1 Replace the correction and count paragraphs with one status `UButton variant="link"`: warning tone before a save attempt and error tone after, focusing the first correction, and "N changes to save" when clean. Show backend details inside the save-error alert only when `apiErrors` exist, and wrap buttons with `flex flex-wrap justify-end gap-2`. Verify with modal tests for the pre-attempt status, the status focusing without a mutation, and a network failure showing the uncertainty message once, keeping edits and sending a single request.
- [x] 4.2 Remove `disabledSaveStyle`. Use `color`/`variant` neutral-subtle when nothing is selected and primary with `loading` while busy. Verify with modal tests asserting the disabled attribute and the neutral-vs-primary state (no inline style string), including during a pending save. Report light/dark visual verification as unrun unless authorized.
- [x] 4.3 Add a server-routing modal test: skip draft row 0 and bullet 0, have the mock return a realistic `experiences[0].bullets[0]` message, and assert the message and focus on the actual draft row. Verify that it passes.

## 5. Reuse outside the CV files

- [x] 5.1 Extract `components/app/AiCostNotice.vue` (prop `usage`) from `ParseModal.vue` and `CvImportModal.vue`. Add an `isHttpUrl` util used by the CV utility, `pages/listings/[id]/edit.vue` and `utils/collectedJobs.ts`. Build CV locations with `locationInput`. Match the copy-prompt button's success color and 1500 ms reset. Verify that the existing ParseModal, listing edit, collected-job and CV tests pass.

## 6. Documentation and verification

- [x] 6.1 Update `docs/REUSABLES.md` (CV utility exports, issue model, the `apiErrors` save outcome, `ProfileCvField`, `focusIssue`, `AiCostNotice`, `isHttpUrl`) and `.claude/state/ui-inventory.md` (move the CV components to profile Components, and add the new reusables). Verify paths and signatures against the code.
- [x] 6.2 Update `docs/STATUS.md` via log-progress for defaults, inline correction, compact review and footer status. Verify statements against delivered behavior and report E2E/live UI status accurately.
- [x] 6.3 Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, changed-file formatting and whitespace checks; then `pnpm build` and leave `HOST=0.0.0.0 pnpm preview --port 3000` running after checking `lsof -i :3000` per CLAUDE.md. Verify that all pass and the preview starts, or report the conflict.
