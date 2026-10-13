# Tasks

## 1. Prerequisites

- [x] 1.1 Archive `tailored-cv-drafts`, syncing its specs, and archive `cv-pdf-export` without syncing, since it
      duplicates `cv-documents`. Verify: `openspec list --specs` shows `tailored-cv-drafts`, and
      `openspec validate streamline-tailored-cv-flow` passes.

## 2. Data and composable

- [x] 2.1 Add `createdAt` to the `useListing` documents selection, and add a `latestCvDocument(documents)` util that
      returns the newest unsent CV. Verify: a unit test in `tailoredCv.test.ts` covers ordering, sent documents and
      no CVs.
- [x] 2.2 Make `generate()` in `useTailoredCvDraft` save first when the candidate is dirty or has no draft, and stop
      when the save fails. Expose a save-phase flag for the button label, and treat `TailoredCvDraftNotFoundError` as
      unsaved. Verify: `useTailoredCvDraft.test.ts` covers save+generate, save failure with no generate request, and
      generate on a clean draft with no save request.

## 3. Apply handoff

- [x] 3.1 Add an optional `cvDocumentId` prop to `ApplyModal`, used as the initial CV on open. Verify:
      `ApplyModal.test.ts` covers preselected and default-empty opens.
- [x] 3.2 Add an optional `applicable` prop and an `apply` emit to `TailoredCvPdfModal`, rendering Apply with this CV
      in the footer. Verify: `TailoredCvPdfModal.test.ts` checks the button shows only when applicable and emits.
- [x] 3.3 Never download a PDF on its own: frame a fetched blob copy (so the API's Content-Disposition can't force a
      download), add a manual Download action to `TailoredCvPdfModal`, and show a notice
      instead of the frame when `navigator.pdfViewerEnabled` is false. Verify: `TailoredCvPdfModal.test.ts` covers the
      download link and the no-viewer notice.

## 4. Editor page

- [x] 4.1 Replace the intro card with a "Whole CV" AI row. Remember the AI choice in `useCookie('tailored-cv-ai')`,
      and show the one-line summary with Change once a choice exists. Verify: page tests cover a remembered choice skipping the tabs, and Change showing both choices.
- [x] 4.2 Replace the full-screen overlay with a top progress line, and wrap the sections and bar in a fieldset that
      is disabled while analyzing. Back stays outside it. Verify: a page test shows step text and disabled fields
      during analysis, and no overlay.
- [x] 4.3 Add the pending suggestions banner (count, Accept all, Dismiss all, Next with wrap-around) and the
      "N suggestions not reviewed" notice beside Generate PDF. Verify: page tests cover Accept all and the notice
      count.
- [x] 4.4 Give the sticky bar two states: Generate PDF, or Preview PDF plus Apply with this CV. Show the latest-PDF
      row with an "older than the draft" hint, and auto-open the preview after generating. Open the apply form with
      the PDF preselected, and navigate to the listing after a successful apply. Remove the success and generated
      alerts and the save-first text. Verify: page tests cover generate with unsaved edits opening the preview, a reload with a current PDF showing
      Preview and Apply, an edited draft showing Generate, and Apply hidden on a non-Saved listing.

## 5. Listing card

- [x] 5.1 In `TailoredCvCard`, rename the button to "Tailor CV", take the `listing`, and show the latest PDF row with
      Preview. On a Saved listing, show Apply with this CV, which opens `ApplyModal` preselected and emits `changed`;
      wire `changed` on the listing page. Verify: `TailoredCvCard.test.ts` covers the no-draft, draft-only and draft-with-PDF states.

## 6. Checks and handoff

- [x] 6.1 Run the touched unit tests, then `pnpm lint` and `pnpm typecheck`, and fix any failures.
- [x] 6.2 Update `.claude/state/ui-inventory.md` for the changed component props and the new util, and run
      `log-progress` for `docs/STATUS.md`. Run `pnpm build` and serve it with `HOST=0.0.0.0 pnpm preview --port 3000`
      after checking `lsof -i :3000`. Report UI verification as not done unless the owner authorizes a visual check.
