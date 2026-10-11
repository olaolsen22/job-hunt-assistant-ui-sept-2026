# Proposal

## Why

`pnpm test:e2e` fails 1 of 11: `apply.spec.ts` ("applies with an uploaded CV…") times out waiting for
`listing-apply`. The listing page renders a 500 (`Cannot read properties of undefined (reading 'length')`)
because the spec's hand-written `listingById` mock has no `contacts` field. `ListingById` started selecting
`contacts` in 4dd76b6 and the page reads `listing.contacts.length`. Unit tests, lint, and typecheck all
pass, so nothing flagged the stale mock.

## What Changes

- Include the owner-approved investigation and fix for Nuxt setup timeouts in
  `formatMonth.test.ts` and `useListingForm.test.ts`: run these standalone logic tests in a Node
  Vitest project, with explicit imports, while retaining the Nuxt project for existing component tests.
- Import the existing GraphQL helper explicitly in `useListingsList.ts`; the separated projects
  exposed the same Nuxt setup timeout in query tests, and that import restores their targeted run.
- Add `contacts: []` (and the `company.id` / `avoidedAt` fields the query also selects) to the listing mock in
  `test/e2e/apply.spec.ts`.
- Type that mock against the query result (`ListingDetail`) so a field the query adds later fails
  typecheck instead of failing E2E with a 500. This only helps if `pnpm typecheck` covers `test/e2e`; if it
  doesn't, keep the plain field fix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Test-only change, no app behavior changes (`skip_specs: true`).

## Out of scope

- Application behavior. The page reading `listing.contacts` is correct for the contract;
  the form composable only gains explicit imports for its existing Vue/date dependencies.
- A shared E2E fixture/mock module. Only one E2E spec mocks `listingById`, so it isn't needed yet.
- Other E2E specs (10/11 pass) and Playwright config changes.

## Impact

- `vitest.config.ts`, `test/unit/formatMonth.test.ts`, `app/composables/useListingForm.ts`.
- `app/composables/useListingsList.ts` (existing GraphQL helper import only).
- `test/unit/useListingForm.test.ts` is investigated and retains its existing behavior coverage.
- `test/e2e/apply.spec.ts`
- Possibly `test/unit/ListingPage.test.ts` if its mock gets the same `ListingDetail` typing (it already has
  `contacts`, so it's optional).
