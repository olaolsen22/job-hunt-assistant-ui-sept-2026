# Proposal

## Why

Going from a listing to an application with a tailored CV takes too many disconnected steps. "Create draft" creates
nothing. Generate PDF stays disabled until a separate Save. AI suggestions are scattered down a long page. The AI
choice modal repeats on every section. The generated PDF disappears on reload and has no path to Apply. The owner's
real flow is: open the listing, edit the CV, run AI on the whole CV or on sections, generate the PDF, and apply with
it. The UI should follow that order.

## What Changes

- Listing card: "Tailor CV" replaces "Create draft". With a draft, the card shows the latest CV PDF, if any, with
  Preview, plus Edit and Apply with this CV (Saved listings only).
- Editor AI:
  - A "Whole CV" AI button at the top, plus the existing per-section AI buttons. No section picker.
  - The built-in or external choice is remembered. Later opens show a one-line summary with a Change link instead
    of the tabs and cost notice.
  - Whole-CV analysis no longer blocks the page with a full-screen overlay. A progress line shows at the top, and
    the sections being analyzed are locked.
- Suggestions: a single banner shows the count of pending suggestions, with Accept all, Dismiss all and Next.
  Per-section Accept and Dismiss stay.
- Generate PDF:
  - It saves pending edits first, then generates, in one click. It is no longer disabled by unsaved edits.
  - When the latest PDF already matches the saved draft, it reopens that PDF instead of creating a new one.
  - When suggestions are pending, a warning shows beside the button. It doesn't block.
- After generation:
  - The PDF preview opens automatically, with "Apply with this CV" in its footer.
  - The sticky bar's primary action becomes "Apply with this CV" and Generate becomes "Regenerate".
- Apply: the apply form opens on the editor with the new PDF preselected. The listing card's Apply also preselects
  the latest CV PDF.
- Removed: the full-screen overlay, the PDF alerts above the sticky bar, and the "save first" rule and text.

Out of scope: section collapsing or a review-first layout, deleting old PDFs, a hard block on unreviewed
suggestions, PDF content or layout, and backend changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tailored-cv-drafts`: AI entry points, remembered AI choice, non-blocking analysis progress, the suggestion
  banner, and saving as part of generation.
- `cv-documents`: generation saves first and is no longer disabled by edits. The current PDF is reused. The preview
  opens automatically and hands off to Apply. The latest PDF is shown after reload.
- `listing-page`: the Tailored CV card's labels, the latest PDF, and Apply with this CV.
- `application-tracking`: the apply form can open with a CV document preselected.

## Impact

- Code:
  - `app/pages/listings/[id]/cv.vue`
  - `app/composables/useTailoredCvDraft.ts`
  - `app/components/listings/TailoredCvAiModal.vue`
  - `app/components/listings/TailoredCvPdfModal.vue`
  - `app/components/listings/TailoredCvCard.vue`
  - `app/components/listings/ApplyModal.vue`
  - `app/composables/useListing.ts` (adds `createdAt` to `documents`)
- Unit tests: `TailoredCvPage`, `TailoredCvCard`, `TailoredCvPdfModal`, `ApplyModal` and `useTailoredCvDraft`.
- No API or schema changes, and no new packages.
- Prerequisites:
  - `tailored-cv-drafts` is complete but not archived, so its `tailored-cv-drafts`, `listing-page` and
    `application-tracking` requirements are not in the main specs yet. Archive it before this change.
  - `cv-pdf-export` duplicates the archived `generate-cv-pdf` change, which is now the `cv-documents` spec, and its
    behavior has shipped. Archive or drop it without syncing.
- Follow-up (2026-11-08): `rework-cv-template-flow` changes how a whole-CV reply is split into suggestions (per entry
  instead of per list, so experience is reviewed per company) and reuses this change's suggestion banner in the CV
  template editor. Archive this change before that one.
