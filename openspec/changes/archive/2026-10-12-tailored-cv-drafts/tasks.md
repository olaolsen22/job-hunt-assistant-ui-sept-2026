# Tasks

## 1. Draft logic

- [x] 1.1 Add `app/utils/tailoredCv.ts` with GraphQL documents typed via `ResultOf`, building a candidate from the profile, applying an analysis result to a section, converting to the save input and plain-text output; verify with `test/unit/tailoredCv.test.ts` (seed keeps source ids and contact fields, result keeps only selected bullets and skills, FAILED leaves the section unchanged, text output order)
- [x] 1.2 Add `useTailoredCvDraft(listingId)`: draft query, candidate, dirty flag, suggestions (accept/dismiss), sequential analysis with step progress and per-section errors, external prompt/preview, and save; verify with unit tests using `registerEndpoint` (auto analysis runs experiences, then skills, then summary, and sends no save; with a saved draft, results become suggestions; the save payload is complete)

## 2. Editor page

- [x] 2.1 Briefly consult ui-ux-expert on the section editor layout and suggestion compare view, then build `app/pages/listings/[id]/cv.vue` with section editors, Built-in AI / External AI tabs reusing the copy-prompt and paste-JSON pattern, the blurred progress overlay, inline section errors, a sticky Save draft and Copy as text; verify with a `mountSuspended` test (no draft → overlay, then filled candidate; preview error shown; save calls the mutation)
- [x] 2.2 Add the unsaved-changes leave guard with `AppConfirmModal` and `beforeunload` (active while analysis runs or the candidate is dirty); verify with tests that canceling keeps the page and edits, and that `beforeunload` is prevented only in those states

## 3. Listing page and apply

- [x] 3.1 Add the `ListingsTailoredCvCard` (loading, empty, saved, error and Copy as text) to the listing page, fetching the draft once; verify with a component test for the empty and saved states
- [x] 3.2 Pass `hasDraft` to `ApplyModal` and show the "Tailor a CV first" link only when there is no draft; verify with a test for both states and that Apply still submits

## 4. Integration

- [x] 4.1 Run the relevant Vitest files, `pnpm lint` and `pnpm typecheck`, then `pnpm build` and the preview on port 3000; report UI verification status (no E2E without authorization); update `.claude/state/ui-inventory.md` for new reusable exports and `docs/STATUS.md` via log-progress

## 5. Opt-in AI choice

- [x] 5.1 Stop auto-analysis; add `ListingsTailoredCvAiModal` (built-in with usage and request count / external copy prompt + paste + preview) opened by "Optimize with AI" and each section/experience AI button; scope external previews to the section; verify with page tests (opening runs no AI, section built-in sends one request, whole-CV overlay, external preview error) and a composable test for scoped preview
- [x] 5.2 Rerun relevant tests, `pnpm lint`, `pnpm typecheck`, build and preview; update inventory and STATUS

## 6. Education analysis

- [x] 6.1 Add EDUCATION steps after experience (regenerate GraphQL types), per-education AI button, suggestions and errors; verify with util and composable tests for education results and the experience → education → skills → summary order
