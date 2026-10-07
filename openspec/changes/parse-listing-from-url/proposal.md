# Proposal

## Why

The parse modal needs the ad text pasted in by hand. The API can now fetch and parse a saved listing's own ad
URL (`parseListingFromUrl(input: { listingId })`), so for most sites the owner can skip the copy-paste step.

## What Changes

- The parse modal on the edit page (Analyze from the detail page, or "Paste from ad") gets a **Parse automatically**
  button that parses the saved listing's URL. The API reads the URL; the client sends only the listing id.
- Shows a loading state for the 10-25 s call; no short client timeout.
- On success the result is merged into the form like a pasted-ad parse (`mergeDraft`); nothing is saved until Save changes.
- Failures (`FAILED` job, `InvalidParseRequestError`, `ListingNotFoundError`) show inline with the paste flow still available.

Out of scope:

- The add page: there is no saved listing yet, so no button there.
- Parsing unsaved URL edits (the API uses the saved URL).
- Subscriptions / SSE, the paste flow, `updateListing`, quick-add, any API change.

## Capabilities

### New Capabilities

- `listing-url-parse`: merging an existing listing's ad, fetched by the API from the saved URL, into its edit form.

### Modified Capabilities

(none)

## Impact

- `app/composables/useParsePrompt.ts`: `parseFromUrl(listingId)`.
- `app/components/listings/ParseModal.vue`: optional `listingId` prop, button, inline error.
- `app/pages/listings/[id]/edit.vue`: pass `:listing-id`.
- Tests: `test/unit/ParseModal.test.ts`.
