# Tasks

## 1. Typed generation and draft recovery

- [x] 1.1 Run `pnpm gql:gen` against the updated backend `schema.graphql` before adding the literal GenerateCvDocument operation with `document { id fileName }` and `errors { __typename ... on Error { message } }`; verify generated types include the operation's fields and both typed errors without hand-written API types.
- [x] 1.2 Extend `useTailoredCvDraft.ts` with generation state, duplicate-request prevention, returned document metadata, and explicit missing-draft/listing recovery; verify focused `useTailoredCvDraft.test.ts` cases cover success, both errors, transport failure, loading reset, and no automatic retry.
- [x] 1.3 Make missing-draft recovery preserve the candidate and allow saving it again even if the saved comparison was clean; verify a composable regression test recreates a missing draft without losing edits. Update the composable inventory entry for the added exports and verify its references.

## 2. Editor actions and document access

- [x] 2.1 Add Generate PDF to the editor sticky bar for persisted drafts, with clean/saving/AI/generating guards, progress, save-first guidance, and version-retention text; extend `TailoredCvPage.test.ts` to verify first-save/reopened-draft eligibility, disabled dirty/busy states, and duplicate-click prevention.
- [x] 2.2 Coordinate success with the existing `useListing` refresh and show returned filename plus authenticated Open PDF using the existing external new-tab link pattern; verify page tests assert refresh, correct `/api/documents/{id}` link, and repeat generations using distinct returned ids without deleting documents or submitting an application.
- [x] 2.3 Add inline typed-error recovery and separate refresh-failure handling with a refresh-only retry; verify page tests cover save-first recovery, listing-unavailable navigation, retained success link after refresh failure, and no second mutation during refresh retry.
- [x] 2.4 Verify refreshed generated CVs remain selectable through existing unsent filtering with a focused `ApplyModal.test.ts` regression case; update `docs/STATUS.md` via log-progress for generation and browser preview/download, and verify changed documentation links and formatting.

## 3. Integration validation

- [x] 3.1 Run the relevant draft composable, editor page, and apply-modal unit suites, then `pnpm lint` and `pnpm typecheck` once after the coherent implementation batch; record results and resolve relevant failures.
- [x] 3.2 Run `pnpm build`, inspect port 3000 with `lsof -i :3000`, and serve the build with `HOST=0.0.0.0 pnpm preview --port 3000` if available under project rules; leave preview running and report any port conflict. Record E2E/live UI as not run unless separately authorized.
