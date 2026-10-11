# Tasks

## 1. Typed collection preparation

- [ ] 1.1 Run `pnpm gql:gen` against the configured sibling schema and add the literal `CheckListingUrls` query in `app/utils/collectedJobs.ts`, selecting index, normalizedUrl, and shouldProcess with types derived using ResultOf. Verify generated types contain the operation/result and the query uses the existing authenticated `gql` transport.
- [ ] 1.2 Add JSON collection validation for non-empty `{ url, text }` arrays and row-specific errors. Add unit tests in `test/unit/collectedJobs.test.ts` for valid input, malformed/empty input, missing fields, and invalid URLs; verify invalid input never starts checking.
- [ ] 1.3 Implement sequential batches of at most 100 URLs, batch-local index mapping, original-order retention, normalized URL tracking across batches including skipped results, atomic success output, and fresh tracking per run. Add and run helper tests covering shuffled results, 201 rows (100/100/1), same-batch rejection, normalized repeats across chunks, and accurate counts.
- [ ] 1.4 Add helper tests for a second-batch failure, retry from the beginning, and missing/repeated/out-of-range result indexes. Verify later requests stop, no partial result is returned, and a fresh retry does not retain earlier normalized URL state.

## 2. Quick-add collected-jobs flow

- [ ] 2.1 Extend `app/pages/listings/quick-add.vue` with Paste text / Collected jobs input modes, the JSON example, Check jobs loading action, inline validation/check errors, and remaining/skipped summary. Follow the inline ui-ux-expert advice in design.md; extend `test/unit/QuickAdd.test.ts` to verify invalid input, summary counts, and the all-skipped empty state.
- [ ] 2.2 Gate built-in parsing and external prompt copying on a successful non-empty preparation, passing only retained original URLs/text to existing useParsePrompt methods. Invalidate preparation and counts on input edits, disable input/actions while checking, and preserve input on failure. Add and run QuickAdd tests verifying both payloads, disabled actions before/during checks, failure/session-expiry blocking, retry, and edit invalidation; retain existing free-text, reply, and save behavior tests.
- [ ] 2.3 Update `docs/STATUS.md` using log-progress for the new input/check flow and record the feature-scoped helper in `docs/REUSABLES.md` and `.claude/state/ui-inventory.md` if it exports reusable functions. Verify documentation matches implemented controls and records E2E/UI verification status honestly.

## 3. Integration checks

- [ ] 3.1 Run the relevant helper and QuickAdd unit tests, `pnpm lint`, `pnpm typecheck`, changed-file Prettier checks, and `git diff --check`. Confirm all pass; report E2E/live UI as not run unless separately authorized, and preserve unrelated owner edits.
