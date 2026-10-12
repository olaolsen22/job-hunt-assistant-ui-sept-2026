# Proposal

## Why

The reviewed tailored CV can be saved, but the UI cannot turn it into an application-ready PDF. The API now generates a document from that saved draft and exposes it through the existing authenticated document endpoint.

## What Changes

- Add Generate PDF to the tailored CV editor once a persisted draft exists; require current edits to be saved first and disable the action while generation runs.
- Confirm successful generation, refresh `listing.documents`, and offer an authenticated Open PDF link. Existing document links provide browser preview and download.
- Explain that each generation creates a new unsent CV and keeps older documents.
- Show save-first recovery for `TailoredCvDraftNotFoundError` and listing-unavailable recovery for `ListingNotFoundError`.
- Regenerate GraphQL types from the updated backend schema during implementation.

Out of scope: PDF layout customization, automatic generation after save, automatic application submission, a new document manager, and backend changes.

## Capabilities

### New Capabilities

- `cv-documents`: generate PDFs from saved tailored drafts, expose authenticated access, and preserve document versions.

### Modified Capabilities

None. This adds generation to the editor delivered by the pending `tailored-cv-drafts` change; existing application document selection and listing document links are reused.

## Impact

- Extend `app/pages/listings/[id]/cv.vue` and its existing draft composable with generation state and typed error handling; refresh the shared `useListing` query.
- Reuse `app/components/listings/Application.vue` document links and `DocumentPicker.vue` unsent document selection.
- Use `generateCvDocument(input: { listingId })`, returning `document { id fileName }` and typed error messages; regenerate `app/graphql-env.d.ts` with `pnpm gql:gen`.
- Add focused composable/page tests. No new packages or API changes.
