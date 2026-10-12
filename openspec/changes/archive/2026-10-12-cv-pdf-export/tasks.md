# Tasks

## 1. Types and mutation

- [ ] 1.1 Run `pnpm gql:gen`; confirm `generateCvDocument` and `TailoredCvSection` `EDUCATION` appear in `app/graphql-env.d.ts` and no exhaustive section map or `switch` needs a new case (`rg "TailoredCvSection|'SKILLS'" app`).
- [ ] 1.2 Add the `GenerateCv` mutation, loading state, duplicate-request guard, and typed error results to `useTailoredCvDraft.ts`; extend `useTailoredCvDraft.test.ts` for success, both errors, transport failure, and no automatic retry.

## 2. Editor

- [ ] 2.1 Add Generate PDF beside Save draft in `cv.vue` with clean/persisted/busy guards, progress, save-first guidance, and the "new unsent PDF each time" note; cover eligibility and double-click in `TailoredCvPage.test.ts`.
- [ ] 2.2 Show the result with Open PDF (`/api/documents/{id}`), refresh the listing documents, handle refresh-only retry and both typed errors inline; page tests assert refresh, link, two generations, and error recovery.
- [ ] 2.3 Add an `ApplyModal.test.ts` case that a refreshed unsent `CV` document is selectable.

## 3. Validation

- [ ] 3.1 Run the three affected unit suites, then `pnpm lint` and `pnpm typecheck` once.
- [ ] 3.2 Update `docs/STATUS.md` via log-progress; run `pnpm build` and serve with `HOST=0.0.0.0 pnpm preview --port 3000` after checking `lsof -i :3000`. E2E/live UI not run unless authorized.
