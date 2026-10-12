# Proposal

## Why

The API now matches the master profile against one listing and stores one editable tailored CV draft per listing.
The UI has no way to create, review or save that draft, so the owner still tailors CVs by hand outside the app.

## What Changes

- New full page `/listings/[id]/cv` to create and edit the listing's tailored CV draft.
- The editor opens prefilled from the profile; no AI runs on its own. "Optimize with AI" (whole CV) and an AI button
  per section open a choice: built-in AI (today's usage shown; whole CV runs one request per section behind a blurred
  progress overlay) or external AI (copy the prompt to the clipboard, paste the JSON back, preview).
- Results never save on their own. Over an existing draft or edits, AI results appear per section with Accept /
  Dismiss. Save draft sends the complete candidate. Leaving with unsaved changes asks first.
- Contact fields are filled from the profile and can be edited, because the external prompt leaves them out.
- "Copy as text" copies the draft as plain text.
- Listing page: new "Tailored CV" card with Create draft, or Edit and Copy as text once a draft exists.
- Apply modal: a "Tailor a CV first" link when the listing has no draft.

Out of scope: PDF generation, attaching the draft when applying, SSE progress (planned later) and changes to the API.

## Capabilities

### New Capabilities

- `tailored-cv-drafts`: creating, analyzing, reviewing, editing, saving and copying a listing's tailored CV draft.

### Modified Capabilities

- `listing-page`: adds the Tailored CV card.
- `application-tracking`: the apply form links to the draft editor when no draft exists.

## Impact

- New: `app/pages/listings/[id]/cv.vue`, listings components for the card, editor sections and suggestions, a
  composable for draft state and analysis, and a utility for candidate building and plain-text output.
- Changed: `app/pages/listings/[id]/index.vue`, `app/components/listings/ApplyModal.vue`.
- API: `tailoredCvDraft`, `tailoredCvExternalPrompt`, `analyzeTailoredCvSection`, `previewTailoredCvDraft` and
  `saveTailoredCvDraft`. Built-in analysis uses AI provider calls, one per section. No new packages.
