# Tasks

## 1. Optional CV on apply

- [x] 1.1 Run `pnpm gql:gen`; verify `cvDocumentId` in `app/graphql-env.d.ts` is no longer `NON_NULL`
- [x] 1.2 Add an optional `help` prop to `ListingsDocumentPicker`, passed to `UFormField`; update `docs/REUSABLES.md`
- [x] 1.3 In `ApplyModal.vue`: drop `required` from the CV picker, add `help="Optional. No CV? Say how you applied in the note."`, send `cvDocumentId: cvId.value ?? null`, disable confirm only on `!appliedAt`; verify with `pnpm typecheck`
- [x] 1.4 Add `test/unit/ApplyModal.test.ts` (`mountSuspended` + `registerEndpoint`): confirm without documents sends `cvDocumentId: null` and emits `changed`
- [x] 1.5 Add a ListingPage test case: Applied listing with no sent documents renders without a "Sent" badge

## 2. Checks

- [x] 2.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` pass; E2E not run (owner may add a no-CV case to `test/e2e/apply.spec.ts`)
- [x] 2.2 `pnpm build` then `pnpm preview --port 3000`; UI unverified unless the owner approves a live check
