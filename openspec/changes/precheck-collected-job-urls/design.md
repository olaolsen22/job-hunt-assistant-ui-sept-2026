# Design

## Context

See proposal.md for motivation. Quick-add currently sends the unstructured `ad` string through `useParsePrompt('listingQuickParsePrompt')`, either to the built-in QUICK parser or the clipboard; `addRows` receives the AI reply afterward. There is no pre-AI collection model. The owner chose to add structured collected-job input to this page.

The API schema defines `checkListingUrls(urls: [String!]!): [ListingUrlCheckResult!]!` with `index: Int!`, `url: String!`, `normalizedUrl: String!`, `existingListingIds: [Int!]!`, `duplicateOfIndex: Int`, and `shouldProcess: Boolean!`. Generated `app/graphql-env.d.ts` currently lacks this operation/type. The 100-URL limit, batch-local indexes, saved-listing coverage, and login requirement are supplied by the requested contract; the schema alone does not describe those semantics.

## Goals / Non-Goals

**Goals:** Keep row identity intact, publish preparation only after every batch succeeds, and reuse the current session, GraphQL transport, prompt, and parser.

**Non-Goals:** Infer row boundaries or URLs from arbitrary text, reproduce backend normalization or duplicate rules, or redesign save-time duplicate handling. The existing previous-attempt requirements remain relevant when saving manually supplied or reposted listings; collection filtering is an earlier, separate gate.

## Decisions

### 1. Explicit collected-jobs input and preparation step

Add a local input-mode control in the existing quick-add paste card: Paste text / Collected jobs. Keep Paste text as the default. Collected jobs uses a labelled `UTextarea` with a concise JSON example such as `[{ "title": "Waiter", "companyName": "Acme", "url": "https://example.com/job/1" }]`. Accept complete listing objects and require only a valid string URL for eligibility checking. Preserve every original field, including nested arrays and null values. Trim URLs only when validating and building query variables; reject the whole collection with an inline row-numbered error if a URL is invalid. The owner clarified that collected input uses the full listing JSON shape, without a required text field. CSV and scraping remain excluded.

An explicit Check jobs button prepares the collection, followed by the summary and current built-in/external AI controls. Inline UI/UX advice: reuse the page's `UCard`, `UFormField`, `UTextarea`, `UButton`, and existing built-in-parser checkbox; use `UAlert` for check errors, muted summary text, and a centered empty message when all jobs are skipped. Stack input, summary, and actions at every width, wrapping long text. Keep existing theme and touch sizes; no table or new shared UI component is needed.

Checking disables collected input and AI actions; on completion users can edit again, which clears prepared data and counts. Disable repeated check/parse actions while busy. Store this state locally, not in Pinia. An async check performed within Copy prompt was considered but rejected: the existing prompt helper explicitly warns that awaiting network work can lose clipboard permission. The separate check step makes the counts reviewable and keeps clipboard writes on a fresh click.

### 2. Feature-scoped typed preparation helper

Place input parsing, the literal `CheckListingUrls` document, and collection preparation in `app/utils/collectedJobs.ts`, scoped to this feature. Derive result types with `ResultOf<typeof CHECK_LISTING_URLS>` after running `pnpm gql:gen`. Select `index`, `normalizedUrl`, and `shouldProcess`, the fields needed for filtering; the other schema fields do not drive the decision. Use `gql(document, { urls })` through the same-origin `/graphql` proxy, retaining the existing cookie login session. No new auth or direct backend fetch is needed.

Check consecutive chunks sequentially with at most 100 URLs. A run-local set stores normalized URLs from completed batches. For each batch, map results by `index` to the chunk rows, then walk those rows in input order. Retain a row only if `shouldProcess` is true and its normalized URL was absent from earlier batches. Add all returned normalized URLs, including skipped ones, to tracking for the next batch. The API remains responsible for within-batch duplicates. `batchOffset + index` identifies the original row; never zip by response position or map by raw URL.

Sequential checks were chosen over parallel checks to stop later requests on failure and make cross-batch first-occurrence behavior simple. Accumulate locally and publish `{ rows, remaining, skipped }` only on full success; reset tracking for every run. Require one result per submitted index: missing, repeated, or out-of-range indexes are an unsuccessful check, not permission to process unchecked jobs.

### 3. Both AI actions consume one prepared payload

Serialize only retained complete listing objects into a formatted JSON array, preserving every original field. Empty preparations produce no posting payload. Pass that same prepared string to existing `parse` or `copy`; do not pass unchecked collected JSON or skipped objects. These functions and other consumers remain unchanged. Parse results continue through `addRows` and the existing explicit save flow.

Keep prepared content reusable when toggling built-in/external AI or when parsing fails, as long as the input has not changed. A URL-check failure blocks both collected AI actions, retains the original input, and shows the thrown API message when available, otherwise the existing generic message. Unlike the current parser fallback, check failure must never offer an unchecked collected prompt. Retry checks the whole collection. An empty result also blocks both actions and shows zero remaining plus skipped count.

## Risks / Trade-offs

- [Saved state can change after checking] → Save-time API duplicate validation remains authoritative; preparation is not a reservation.
- [Large collections require multiple requests] → Sequential 100-URL chunks with a loading action and no partial AI submission.
- [Structured input adds a step] → A visible JSON example and Check jobs summary keep the flow clear while retaining free-text mode.
- [Generated types are stale] → Regenerate from the configured sibling schema before declaring the query; do not hand-edit or copy the backend schema.

## Migration Plan

Regenerate GraphQL types and implement the helper and quick-add mode together. No data migration or backend deployment is required. Removing the collected mode and helper restores the prior UI; existing saved listings are unaffected.
