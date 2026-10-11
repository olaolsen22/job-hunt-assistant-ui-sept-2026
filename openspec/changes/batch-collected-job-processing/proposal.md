# Proposal

## Why

Quick-add currently sends every retained collected job to the built-in parser in one request. Smaller batches keep each AI request focused, while visible progress and recoverable failures make large collections easier to process and review.

## What Changes

- After the existing URL checks succeed, process retained full listing objects through built-in AI sequentially, with at most 20 jobs per request. Use smaller batches when needed to stay within the API's documented 12,000-character text cap; never truncate a job.
- Show a persistent progress bar, processed-job count, and current batch. Count a batch only after its response is accepted, and distinguish processed, skipped after failure, and not yet processed jobs.
- Pause when a batch fails and ask the user to retry that batch, skip it and continue, or stop and review completed work. Preserve successful results and never automatically rerun them or switch parser methods.
- Stage successful batch results and expose them together for review on completion or a chosen stop. Processing creates drafts; saving remains an explicit action.
- Apply the consulted UX agent's recommendations: clear Check duplicates → Process jobs → Review → Save stages, explicit Built-in AI / Use your own AI choice, contextual actions, inline errors, and controls disabled while processing.
- Confirm before discarding unsaved drafts or batch progress, including before the first save. This supersedes the current unarchived `quick-add-save-flow` requirement that permits leaving without confirmation when nothing has been saved.
- Keep external AI copying and free-text parsing on their current single-payload workflows. No backend changes, concurrent AI calls, persistent queues, SSE work, or unrelated listing-layout changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-creation`: Add collected-job AI batching, progress, user-selected recovery, staged review, and clearer processing controls; modify the pending Leaving quick-add requirement to protect unsaved work.

## Impact

- `app/pages/listings/quick-add.vue`: processing stages, progress, recovery, result publication, busy controls, and navigation confirmation.
- A feature-scoped collected-job batch helper/composable: batch planning, execution state, completed results, and recovery decisions. Reuse `CollectedJob`, `PreparedJobs`, and `useParsePrompt('listingQuickParsePrompt')`.
- Reuse `parseListing(input: { text, mode: QUICK })` via the existing authenticated same-origin GraphQL transport; schema and generated types already expose the needed parse status/result/error fields.
- Reuse `UProgress` from the dashboard pattern, `UCard`, `UAlert`, existing review rows, and `AppConfirmModal`; no new dependencies.
- Extend helper/page unit tests and update UI documentation during implementation. Coordinate spec sync/archive after `precheck-collected-job-urls` and `quick-add-save-flow` so this change's later behavior wins.
