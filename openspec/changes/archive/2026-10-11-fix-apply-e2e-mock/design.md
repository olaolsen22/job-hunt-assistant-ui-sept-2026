# Design

## Context

See proposal.md for the recorded failure. The Apply E2E test supplies its own GraphQL response through
Playwright routing. Its listing fixture is untyped and no longer matches `ListingById` in
`app/composables/useListing.ts`. The unit listing-page fixture already supplies the missing fields.
GitHub's E2E job builds the app and runs Chromium independently of the lint, typecheck, and unit job.
The latest GitHub logs have not been independently retrieved; the diagnosis is based on the recorded
failure and the current source.

## Goals / Non-Goals

**Goals:** Restore the existing Apply browser journey and catch future missing fixture fields during
typecheck when the current TypeScript configuration includes the E2E file.

**Non-Goals:** Change application behavior, introduce shared fixtures, or extend backend integration
coverage. No new dependencies or GitHub workflow changes.

## Decisions

- Explicitly import the existing `graphql` helper in `useListingsList.ts`. After splitting projects,
  its query tests also timed out in Nuxt setup; the targeted 11-test run passed with this import.
  Preserve their Nuxt environment and assertions. No query logic changes are needed.
- Owner-approved scope extension: isolate `formatMonth.test.ts` and `useListingForm.test.ts` in a
  Node Vitest project. Their setup hooks time out even in a two-file run and with auth mocked.
  They need only formatting functions and Vue reactivity, so initializing the whole Nuxt app adds an
  unrelated failure point. Add explicit imports for the tested formatters and the form's existing
  `reactive`/`todayIso` dependencies. Keep all other tests in a Nuxt project with mutually exclusive
  includes/excludes. Increasing the setup timeout would retain unnecessary app initialization;
  per-file environment overrides would retain Nuxt Vite plugins in a hybrid environment.
- Match the selected response by adding `contacts: []`, `company.id`, and `company.avoidedAt` to the
  existing fixture. Adding fallback logic in the page would hide a test-data defect; the selected
  contract already provides these fields.
- Use the existing query-derived `ListingDetail` type with `satisfies` if E2E files participate in
  `pnpm typecheck`. During implementation, verify coverage with a temporary deliberate fixture type
  error and restore it before final checks. If the file is excluded, retain the field fix and record
  that limitation; expanding TypeScript or CI configuration is outside this change.
- Keep the existing assertions for the mutation input, Applied badge, and timeline. These exercise
  the failing page and its refresh after applying, so no additional behavior test is needed.

## Risks / Trade-offs

- Typecheck may exclude E2E fixtures -> Verify inclusion before claiming drift protection. The
  targeted browser test remains the regression check when typing is not covered.
- Current GitHub failures may differ from the recorded Apply failure -> Compare the failing run's
  job, commit, and error during implementation if logs are available; report any separate failure
  rather than expanding this change silently.
- Local E2E passes do not prove the pushed commit passes CI -> After the owner requests a commit and
  push, verify the corresponding GitHub Checks run. Local verification uses the targeted Apply test
  followed by the full existing E2E suite.
