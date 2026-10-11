# Design

## Context

See proposal.md for motivation and scope. The uncommitted `precheck-collected-job-urls` implementation already preserves full listing objects, checks URL chunks of 100, filters cross-chunk normalized repeats, and serializes all retained objects into one posting. Quick-add calls `useParsePrompt('listingQuickParsePrompt').parse()` once. Its `addRows()` both appends rows and clears source/hides the input card, so calling it per batch would lose processing context. Parser failures currently toast and switch to external AI.

The current API schema exposes `parseListing(input: ParseListingInput!)`, whose input is `text: String!` and `mode: ParseMode!`; QUICK is supported. The payload exposes parseJob.status/result/error and errors with messages. Generated types include these fields. API docs/STATUS.md says parsing currently runs inline, with a 12,000-character text cap and an 8,192-token output cap. The schema also lists queued/running/retrying states but provides no within-request progress percentage. Progress must therefore be based on completed client batches, not token estimates or invented API progress fields.

The owner chose built-in-only batching, asking on failures, and confirmation before discarding work. A delegated ui-ux-expert review found ambiguous parser selection, controls active during work, loss of input via addRows, no persistent processing progress/error, and navigation gated by savedCount rather than unsaved work. Recommendations below are from code inspection; no live UI was run.

## Goals / Non-Goals

**Goals:** Preserve full eligible inputs, process sequentially, retain successful batches, make failures a user decision, and show honest progress without saving automatically.

**Non-Goals:** New AI endpoints, shared queue infrastructure, concurrent calls, persistent cross-page recovery, automatic retries, batching external AI/free text, or changing save-time duplicate review.

## Decisions

### 1. Plan requests by both item count and serialized size

Add a feature-scoped `app/composables/useCollectedJobProcessing.ts` and a small pure planner in `app/utils/collectedJobBatches.ts`. Keep state local to quick-add. Use the existing retained `PreparedJobs.rows` as an immutable snapshot for a run; no new validation shape or required text field.

Plan consecutive batches greedily with at most 20 objects and at most 12,000 characters in the exact compact JSON text sent to `parse()`. Count brackets, commas, quotes, and escaping in the serialized length. Compact JSON preserves all properties while leaving more room than pretty JSON. Validate the entire plan before starting: if one object cannot fit, show its position in the retained collection and require correction rather than truncating it. Existing external copying keeps its formatted whole-collection payload.

Sequential processing through the existing parse method avoids a new GraphQL operation and lets a failed batch pause before any later request. Fixed batches of exactly 20 regardless of text size risk the documented input cap; parallel calls make failure decisions and order harder. No numeric API limit exists in SDL, so keep the text budget as a documented local constant tied to the backend status reference.

### 2. Track a run independently from the existing row form

The runner owns planned batches, cursor, accepted results by batch, skipped batch indexes, completed input-job count, error, and idle/running/paused/finished/stopped state. A request succeeds only when parse returns a result containing an array of listing objects with the expected count. Reuse the existing tolerance for surrounding prose/code fences when extracting the array, then validate structure before accepting the whole batch. Missing form fields still use existing review validation; malformed or count-mismatched replies are batch failures. The API does not guarantee one draft per input in its typed contract because result is a string, so this check prevents counting silently omitted jobs as complete.

Separate pure reply decoding/row mapping from `addRows()` lifecycle side effects. Collect accepted raw drafts during the run, then publish them through one append operation when all batches are resolved or the user chooses Stop and review. Mark publication so rerenders, retries, and repeated completion actions cannot append twice. Preserve prior rows and their edits/saved results. Do not clear the original collection or prepared check summary during intermediate requests.

Display progress as completed input jobs divided by the original retained-job total. Show current batch/total while running and keep successful, skipped-after-failure, and unprocessed counts afterward. URL-check skips stay a separate earlier count. A run that finishes after skipping a failure is labelled Finished with skipped jobs, not All jobs processed; its success bar remains below 100%.

### 3. Pause and ask on each failed batch

Show a persistent inline UAlert with batch number, API or parsing error, and completed count. Recovery actions are Retry batch (primary), Skip batch and continue, and Stop and review. No subsequent request runs until the user chooses. Retry resends only that batch; skip records its original input jobs and advances; stop publishes successful results and records remaining jobs as unprocessed. Each repeated failure asks again. Input stays available for recovery, including skipped job data.

Do not silently switch parser methods on collected-run errors. Do not automatically replay successful batches on a new click. A deliberate restart discards the run state only after confirmation and never removes previously saved rows. Paused processing locks conflicting input/row/save controls, but recovery and confirmed navigation remain available. A stop choice ends that lock and exposes partial results for review.

### 4. Make the collected flow and action hierarchy explicit

Reuse the current UCard and row review UI; no new shared wizard. Present the collected stages as Check duplicates → Process jobs → Review → Save, with short headings or a simple stage summary. Replace the parser checkbox with an explicit Built-in AI / Use your own AI choice, following the distinction used in ListingsParseModal. Keep input mode and AI method visually separate; show external copy/reply controls only for that method.

After checks, show N collected · M skipped · K ready and a primary Process K jobs action. Add the same UProgress model-value/max pattern already used by `app/components/dashboard/LlmUsage.vue`, labelled Processing jobs, plus M of K processed · Batch X of Y text. Announce completed-batch status with a polite live region; use no time estimate. Keep progress/error/recovery visible at the processing action; show Processing incomplete when stopped.

Processing copy explicitly says it creates drafts and saves nothing. On completion or stopping, expose the existing editable rows and explicit Save action. Disable input, input/AI method switches, checks, add/remove/edit row actions, and save while running or paused. Stacking counts/progress/actions on phones and using existing theme/touch sizes avoids horizontal overflow. Preserve existing flagged/added/not-saved groups and compare actions outside active processing.

### 5. Protect navigation and replacement of prepared work

Use one hasUnsavedWork calculation for pending nonblank rows, prepared collected input, and staged run state. Reuse AppConfirmModal for Back, input replacement, and explicit restart; Vue Router's onBeforeRouteLeave applies the same confirmation to sidebar/browser-back navigation within the app. Add a beforeunload handler only while work exists and remove it on cleanup; the browser controls its confirmation text.

Avoid prompting for every keystroke: once input is checked, keep the source read-only behind an Edit collected jobs action that confirms before invalidating prepared work. Before checking, input stays editable. Finished runs can collapse the source into a summary with the original input recoverable, and clear obsolete prepared state when results are published so saving all drafts restores View listings without a spurious prompt. Stopped/skipped run summaries retain their source until the owner explicitly dismisses/replaces them with confirmation.

Use a run generation identifier or disposal flag: confirmed leave/restart invalidates the run; an in-flight request may finish on the backend, but its late response cannot mutate discarded state or schedule another request. This is a client lifecycle guard, not cancellation of the server's AI work. Cancelled navigation leaves the current run intact.

## Risks / Trade-offs

- [Batches of 20 do not by themselves prevent oversize input] → Plan by exact compact JSON size too, and fail before starting for an oversized single item.
- [Skipped batches leave processing incomplete] → Separate processed/skipped/unprocessed totals, preserve failed input, and do not claim 100% success.
- [Stopping/confirmed navigation cannot undo an in-flight API call] → Prevent subsequent requests and ignore stale responses; do not promise server cancellation.
- [AI returns untyped JSON] → Validate complete batch structure/count before advancing, then keep existing human review before saving.
- [This supersedes an intentional leave rule] → Owner explicitly selected confirmation; preserve labels and save-only-on-Save behavior while updating the entire Leaving quick-add requirement.

## Migration Plan

Implement on top of the existing precheck changes without replacing their uncommitted work. No backend/data migration or GraphQL type regeneration is expected unless the schema changes during implementation. Keep both external AI and free-text behavior covered by regression tests.

The Leaving quick-add requirement is currently ADDED by unarchived `quick-add-save-flow`, not yet in the main spec. This change's MODIFIED block copies that full requirement and explicitly supersedes its no-confirmation scenario. Before syncing or archiving this change, sync/archive `quick-add-save-flow` and `precheck-collected-job-urls` first using their requested workflows; do not auto-archive them during implementation. Rollback removes collected batching/UX changes while keeping the existing precheck capability.
