# Proposal

## Why

The API (commit 958d9bf) no longer requires a CV on `applyToListing`. Many applications go through
a web form with no CV upload, and the UI still blocks applying until a CV is picked.

## What Changes

- Apply modal: the CV is optional. Applying with no documents is allowed; only the applied date is required.
- A short help text under the CV picker: "Optional. No CV? Say how you applied in the note."
- `ListingsDocumentPicker` gets an optional `help` prop passed to its `UFormField`.
- Regenerate `app/graphql-env.d.ts` so `ApplyToListingInput.cvDocumentId` is nullable, and send `null` when no CV is chosen.
- Applied listings with zero sent documents keep rendering normally (already the case; covered by a test).

### Out of scope

- An "apply method" field (the API has none; the note carries it).
- Any change to undo, archive, delete, or error display. API errors are shown as today.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `application-tracking`: adds the apply requirement, with the CV optional.

## Impact

- `app/components/listings/ApplyModal.vue`, `app/components/listings/DocumentPicker.vue`
- `app/graphql-env.d.ts` (via `pnpm gql:gen`)
- New unit test for the apply modal; `test/e2e/apply.spec.ts` may need a no-CV case (owner runs E2E)
