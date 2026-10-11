# Tasks

## 1. Batch planning and runner

- [x] 1.1 Add a pure collected-job batch planner in `app/utils/collectedJobBatches.ts` using complete retained objects, at most 20 jobs, and at most 12,000 serialized characters per request. Add and run unit tests for 0/1/20/21/43 items, smaller size-limited batches, escaped/nested fields, exact payload preservation, and rejecting one oversized job before any request.
- [x] 1.2 Add local `useCollectedJobProcessing` state for sequential execution through the existing QUICK parser, accepted results, current batch, successful/skipped/unprocessed input counts, and reply validation. Add and run unit tests proving one request at a time, original order, progress only after valid replies, and rejection of malformed/non-array/non-object/count-mismatched replies without accepting partial rows.
- [x] 1.3 Implement paused failure decisions: Retry batch, Skip batch and continue, and Stop and review; invalidate discarded runs so late responses cannot append or start later requests. Add and run runner tests for each decision, repeat failures, retry without replaying successful batches, stopping with partial results, and late-response disposal.
- [x] 1.4 Record the feature-scoped planner/runner exports and contracts in `docs/REUSABLES.md` and `.claude/state/ui-inventory.md`; verify documented state, counters, methods, and payload format match the new exports.

## 2. Collected processing and review UX

- [x] 2.1 Separate reply decoding/row append from the current `addRows` clear/hide behavior. Connect the runner to successfully checked collected jobs and publish staged drafts exactly once on completion or a chosen stop, preserving existing edited/saved rows and explicit saving. Extend and run QuickAdd tests for 43 eligible jobs, filtered input, no intermediate source clearing, partial publication, repeated recovery/completion actions, and no createListing calls during processing.
- [x] 2.2 Apply the consulted UX recommendations in `quick-add.vue`: explicit AI-method choice, visible Check duplicates → Process jobs → Review → Save stages, collected/skipped/ready summary, Process N jobs action, labelled UProgress, current batch/completed count, persistent error and recovery actions, honest terminal counts, and busy-control locking. Add and run page tests for running/paused/finished/stopped states, skipped failures staying below 100% successful progress, accessible status markup, and external/free-text regression behavior.
- [x] 2.3 Update `docs/STATUS.md` using log-progress with the actual batching/recovery/review flow and record E2E/live UI status honestly; verify operation names, labels, and milestone scope against implemented controls.

## 3. Confirm before losing work

- [x] 3.1 Replace savedCount-based leave protection with a consistent unsaved-work check covering pending nonblank drafts, prepared input, and staged batch results. Reuse AppConfirmModal for Back, Edit collected jobs, and restart; protect in-app route changes and register/remove the native beforeunload handler. Add and run tests for leaving before the first save, cancel/confirm during a run, discarded late responses, input replacement, partial-save protection, and no prompt after all work is saved or explicitly dismissed.
- [x] 3.2 Document the expanded navigation/replacement confirmation in `docs/STATUS.md`; verify the no-first-save-confirmation scenario is replaced in implementation/tests, and retain the documented dependency on `quick-add-save-flow` before syncing this delta.

## 4. Integration verification

- [x] 4.1 Run relevant planner/runner/QuickAdd unit tests, `pnpm lint`, `pnpm typecheck`, changed-file Prettier checks, `git diff --check`, and strict validation of this OpenSpec change. Confirm all pass and preserve the owner's uncommitted precheck work. Report E2E/live UI as not run unless separately authorized; do not archive predecessor changes during apply.
