# Design

## Context

The editor (`app/pages/listings/[id]/cv.vue`) drives everything through `useTailoredCvDraft`:

- `save()` and `generate()` are separate. `generate()` needs a persisted draft and returns `{ id, fileName }`.
- The generated document lives only in page state (`state.generated`).
- `useListing` already loads `documents { id kind fileName sentAt }`, and the apply form reads unsent CVs from it.
- The schema's `Document` also has `createdAt`, and the draft has `updatedAt`.
- `ApplyModal` takes `listing` and resets its picks on open.
- `TailoredCvCard` only has `listingId`.

## Goals / Non-Goals

**Goals:** the owner's flow in the fewest clicks, using only existing API operations, with derived state instead of
new stores.

**Non-Goals:** collapsible sections, a section picker, and telling generated PDFs from uploaded CVs (the API has no
field for it).

## Decisions

1. **Generate saves first, inside the composable.**
   - `generate()` calls `save()` when the candidate is dirty or has no draft, and stops if that fails.
   - It exposes one busy flag for both steps, and the button shows "Saving and generating…" during the save phase.
   - Alternative: chaining in the page. The composable already owns `draft` and the dirty state, and its tests cover
     both mutations.

2. **The latest PDF is derived from `listing.documents`.**
   - Add `createdAt` to the `useListing` documents selection.
   - A small util, `latestCvDocument(documents)`, returns the newest unsent `CV`. It has two real uses: the editor and
     the card.
   - "Current" means `latest.createdAt > draft.updatedAt && !dirty`, comparing server timestamps on both sides.
   - After a generate, the existing listing refresh makes the new PDF the latest, which also survives a reload.
   - Alternatives: keeping it page-local, which is lost on reload, or a Pinia store, which isn't shared state.

3. **The sticky bar has two states.**
   - No current PDF: `[Copy as text] [Save draft] [Generate PDF]`, with Generate as the primary action.
   - Current PDF: `[Copy as text] [Preview PDF] [Apply with this CV]`. On a non-Saved listing, Preview PDF is the
     primary action and Apply is hidden.
   - Save draft is hidden while clean, because it can do nothing then.
   - This replaces the "Regenerate" idea: an unchanged draft has nothing new to generate.

4. **The PDF preview opens automatically and hands off to Apply.**
   - The page sets `pdfOpen` after a successful generate.
   - `TailoredCvPdfModal` gains an optional `applicable` prop and emits `apply`.
   - The page closes the preview and opens a lazy `ListingsApplyModal` with the PDF preselected.
   - The success and generated alerts are removed. The refresh-failed and generate-error alerts stay above the bar.

5. **`ApplyModal` gets an optional `cvDocumentId` prop.** The open watcher sets `cvId` from it instead of
   `undefined`.
   - The card mounts its own `ApplyModal` and emits `changed`, which the listing page already handles for the
     application card.
   - In the editor, `changed` navigates to the listing. The leave guard passes because the draft is clean.

6. **The remembered AI choice uses `useCookie('tailored-cv-ai')`.**
   - It is SSR-safe, so the dialog renders the same on server and client.
   - The dialog shows the tabs when the cookie is empty or Change was clicked, and otherwise a one-line summary.
   - Alternative: `localStorage`, which would cause a hydration mismatch or need client-only rendering.

7. **The blocking overlay is replaced.**
   - Wrap the sections and the bar in `<fieldset :disabled="analyzing">`. A native disabled fieldset disables every
     input and button inside it.
   - Show a progress line with step text and a spinner at the top, under the AI row, with `role="status"`.
   - Alternative: passing `disabled` to every control.

8. **The suggestion banner** is a `UAlert` under the AI row, with the count and actions.
   - Accept all and Dismiss all loop over the existing `accept` and `dismiss`.
   - Next scrolls the next pending suggestion's section into view via an element id per suggestion key, wrapping
     around.
   - A pending-count notice sits in the bar beside Generate PDF.

9. **Card copy:** "Tailor CV" replaces "Create draft". The card takes the `listing`, already loaded on the listing
   page, for its documents and status instead of only the id.

## Risks / Trade-offs

- [An uploaded CV newer than the draft counts as the latest PDF] → The UI shows its file name, so the owner can see
  which file it is. This is a stated limitation.
- [Save succeeds but generation fails] → The draft stays saved and clean, so the next click only generates. The error
  shows as before.
- [Disabling the whole fieldset during analysis also disables Back] → Back stays outside the fieldset, and the leave
  guard still asks first.
- [The card gains an Apply entry point beside the application card's Apply] → Both open the same modal. Only the
  card's preselects a CV.
