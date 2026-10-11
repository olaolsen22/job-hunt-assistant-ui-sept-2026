# Proposal

## Why

Collected jobs can include saved listings and repeated links, wasting AI parsing work. Quick-add needs structured input so it can check each URL before preparing jobs for AI.

## What Changes

- Add a collected-jobs input mode to quick-add: a JSON array of `{ url, text }` rows, with a small example and validation before checking.
- Check URLs through the existing authenticated `checkListingUrls(urls)` query in batches of at most 100. Map results by their batch-local `index` back to original rows and retain only `shouldProcess: true` rows.
- Track returned `normalizedUrl` values across batches to skip repeats between chunks, preserving the original order and row content.
- Show remaining and skipped counts before built-in parsing or copying a prompt for external AI. Block both actions on check failure or when no jobs remain.
- Invalidate prepared results when input changes; retain the input for correction and retry.
- Keep the existing free-text, pasted AI reply, and save-time duplicate handling flows. Scraping, URL fetching, backend changes, and single-listing analysis changes are outside scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-creation`: Add structured collected-job input and authenticated URL eligibility checks before AI preparation in quick-add.

## Impact

- `app/pages/listings/quick-add.vue`: input mode, preparation state, summary, and gating of built-in parsing and prompt copying.
- A feature-scoped collected-job helper: input validation, typed query, chunking, index mapping, and cross-batch deduplication.
- `app/graphql-env.d.ts`: regenerate from the existing API schema; it currently lacks `checkListingUrls` and `ListingUrlCheckResult`.
- Reuse `gql`, the same-origin `/graphql` proxy and login session, and `useParsePrompt`. No new dependencies or API changes.
- Add unit coverage for filtering and quick-add behavior; document the resulting UI after implementation.
