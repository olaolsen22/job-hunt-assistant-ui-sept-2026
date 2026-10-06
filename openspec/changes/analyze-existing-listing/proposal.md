# Proposal

## Why

Parsing an ad with the LLM only works when adding a listing. Listings saved by hand (or via quick-add) can't be
filled in from their ad later; the only option is the manual "Mark analyzed" flag. The API has no
per-listing parse, so the UI has to run `parseListing(text, FULL)`, merge the result into the current listing,
and save it with `updateListing`.

## What Changes

- Edit page (`/listings/[id]/edit`) gets a "Paste from ad" button that opens the existing parse modal
  (built-in parser or copy-paste prompt).
- The parse result is merged into the loaded form: parsed values win, existing values stay where the parse
  returned nothing, and the URL is always kept. The listing is marked analyzed.
- Nothing is saved until the user reviews the form and clicks "Save changes" (normal `updateListing` flow).
- New names from the parse (company, role, skills, places) are flagged like on the add page.
- Listing detail page gets an "Analyze" button that opens the edit page with the parse modal already open.

Out of scope:

- One-click analyze-and-save from the detail page (no review step).
- Storing the ad text on the listing or re-fetching the ad from its URL.
- Changes to the add / quick-add flows or the parse modal itself.
- Any API change.

## Capabilities

### New Capabilities

- `listing-analysis`: filling in an existing listing's details from its ad text, merged with what's already saved.

### Modified Capabilities

(none)

## Impact

- `app/composables/useListingForm.ts`: add a merge variant of `fillDraft`.
- `app/pages/listings/[id]/edit.vue`: parse button, modal, new-name check, `?analyze` query.
- `app/pages/listings/[id]/index.vue`: "Analyze" button.
- Reuses `ListingsParseModal`, `useParsePrompt` (`parseListing`, `FULL`), `provideNewNames`, `UPDATE_LISTING`.
- Tests: `test/unit/useListingForm.test.ts`.
