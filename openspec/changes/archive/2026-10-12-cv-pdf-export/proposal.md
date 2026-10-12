# Proposal

## Why

The API can now turn the saved tailored CV draft of a listing into a PDF `CV` document, but the editor has no way to request it. The same API update adds `EDUCATION` to `TailoredCvSection`; the draft editor already handles education analysis, so only the regenerated types need checking.

## What Changes

- Add a Generate PDF action to the tailored CV editor, available only for a persisted, clean draft.
- On success, confirm, show the new file with an authenticated Open PDF link (`/api/documents/{id}`), and refresh the listing's documents so the unsent CV is selectable when applying.
- Say that every generation creates a new unsent PDF and keeps earlier ones.
- Show typed recovery for `TailoredCvDraftNotFoundError` (save the draft first) and `ListingNotFoundError` (listing unavailable).
- Run `pnpm gql:gen` and confirm no exhaustive `TailoredCvSection` map is missing `EDUCATION`.

Out of scope: PDF layout/content (API-owned: one column, fixed section order, `MM/yyyy` dates, empty sections omitted), automatic generation after save, deleting old PDFs, a document manager, backend changes.

## Capabilities

### New Capabilities

- `cv-pdf-export`: generate a PDF CV from the saved tailored draft and reach it from the listing's documents.

### Modified Capabilities

None.

## Impact

- `app/pages/listings/[id]/cv.vue` and `app/composables/useTailoredCvDraft.ts` (mutation, state, errors); listing refresh via the existing `useListing` key.
- `app/graphql-env.d.ts` regenerated; focused composable, page, and `ApplyModal` unit tests; `docs/STATUS.md`.
- Note: the older, still-unimplemented change `generate-cv-pdf` covers the same editor action with a narrower mutation selection. Implement only one of the two, or archive `generate-cv-pdf`, to avoid duplicate work.
