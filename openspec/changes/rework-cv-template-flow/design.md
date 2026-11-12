# Design

## Context

See proposal.md for the motivation. Today:

- `new.vue` uses `useNewBaseCv`, and `[id].vue` uses `useBaseCvEditor`. They repeat the same `replaceContent`,
  `aiDrafted`, `dirty`, seed and layout carry-over code.
- `DetailsModal` creates templates and also renames them.
- `OptionsCard` mixes the AI button with the layout fields.
- On the tailored CV page, whole-CV replies go through `changedCvSections`, which compares whole lists. The page
  already has per-entry suggestion keys (`experience:<id>`) and a pending-suggestions banner, both from
  `streamline-tailored-cv-flow`.
- The AI's content carries `sourceEntryId` on experiences, educations and projects, so entries can be paired.

The advisors (ui-ux-expert and ui-controller) reviewed this flow. Before screenshots are in the session scratchpad.

## Goals / Non-Goals

**Goals:**

- Both template pages share one editor component and one composable.
- Per-entry review comes from one shared splitting function, used by both editors.

**Non-Goals:**

- Merging the two routes into one page.
- Per-bullet review.
- Restoring suggestions after leaving the page.

## Decisions

1. **Two routes, one editor.** A new `cvTemplates/Editor.vue` holds:
   - the empty content state
   - `CvContentEditor`
   - the Layout card
   - the status banner
   - the AI dialog
   - the save-bar frame
   - the leave confirmation

   `new.vue` adds the Details card. `[id].vue` adds the header, language tabs, Versions, the PDF modal and the
   menus. Alternative: one page for both. Rejected because `[id].vue` relies on `baseCv` being present in about 15
   places.

2. **One composable.** `useBaseCvEditor(id | 'new', language)`:
   - New mode has no query.
   - `save(name, description)` calls `createBaseCv`.
   - The saved mode keeps `saveBaseCvVersion`.
   - A new language's draft can be a translation (with flagged paths) or empty, waiting for an AI draft.
   - Suggestions, accept and dismiss follow `useTailoredCvDraft` (`offer`/`accept`/`dismiss`).

   `useNewBaseCv` is removed.

3. **Style lives in content.** CV style and entry format are stored in each version and change the PDF, so they stay
   in the Layout card. The AI dialog reads `cv.template` and sends it to the prompt and the preview. This deviates
   from UX, which suggested the dialog own the style.
4. **Splitting a reply** (in `changedCvSections`):
   - For each entry list, pair entries by `sourceEntryId`.
   - If the reply has no new ids and the shared ids keep their order, emit one key per changed entry, plus a removal
     value for each id the reply lacks.
   - Otherwise emit the whole list.
   - `setCvSection` gets a removal case for an entry key.

   Both editors get this, so the tailored CV page needs no page changes.

5. **Review-only AI in `CvContentEditor`.** The template editor passes a `CvEditorAi` with `review` and `section` but
   no analyze, and the cards hide Analyze when it's absent. Alternative: a separate suggestions prop. Rejected
   because the cards already bind `ai.section(...)`.
6. **One banner.** `cvTemplates/StatusBanner.vue` replaces `AiDraftAlert` and the inline translation alert. It picks
   one message in priority order. The suggestions banner's count, Next, Accept all and Dismiss all copy the tailored
   page's behavior.
7. **Name errors once.** `cvTemplates/NameFields.vue` holds the name and description fields, plus the duplicate-name
   error with its link to the existing template. Both the create page and the rename-only `DetailsModal` use it.

Other deviations from the advisors:

- The list stays full width, without the suggested `max-w-5xl` cap, because the owner reported wasted space.
- Replace with my profile keeps its confirmation when there are edits.
- Undo, and the two-column review layout, are not built.

## Risks / Trade-offs

- **[Risk] The AI drops or reorders entries often, so the review falls back to one whole-list suggestion.** →
  Mitigation: dropped entries are paired as removals. Only added entries or a changed order fall back, and the banner
  says why.
- **[Risk] The tailored CV page's behavior changes, and existing tests assume "All experience".** → Mitigation:
  update the `TailoredCvPage` expectations, and the `tailored-cv-drafts` delta records the change.
- **[Trade-off] Suggestions are lost on leaving or reloading.** The leave confirmation says so.
