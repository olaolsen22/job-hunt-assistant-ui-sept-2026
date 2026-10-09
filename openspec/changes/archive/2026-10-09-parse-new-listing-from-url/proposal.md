# Proposal

## Why

On the add page, parsing an ad means copying its text into the Analyze ad modal. The API now has
`parseUrl`, which reads an ad from a link without saving anything, so a new listing can be filled
straight from the URL the owner already typed.

## What Changes

- The add page's Analyze ad modal gets a "From link" tab (opened by default) with an Ad link input,
  prefilled from the form's Ad link. "Parse from link" is disabled while it is empty.
- It calls `parseUrl(url)` (always a FULL parse); the result fills the form like a pasted ad and the
  link goes into the form's Ad link, so Save sends it in `createListing` as today.
- Errors (bad URL, unreadable page) show in the tab with a "Paste the ad instead" button that
  switches to Paste ad and keeps the link for the form.
- Saved listings are unchanged: the edit page keeps `parseListingFromUrl(listingId)`.
- Dropped after owner/UX review: an inline button by the form's Ad link field, and a From link tab
  that only read the form's field.

Out of scope: quick-add and company pages, polling or subscriptions, opening the modal
automatically, any API change.

## Capabilities

### New Capabilities

### Modified Capabilities

- `listing-creation`: a new listing can be filled by parsing the ad at its typed URL.

## Impact

- `app/composables/useParsePrompt.ts`: `ParseUrl` mutation and `parseNewUrl(url)`.
- `app/utils/parseDraft.ts`: outermost-JSON extraction shared by the modal (moved out of it).
- `app/components/listings/ParseModal.vue`: From link for unsaved listings with its own link input; `apply` also returns the link.
- `app/pages/listings/add.vue`: prefills the modal's link and copies the returned link into the form.
- Tests: `test/unit/ParseModal.test.ts`.
