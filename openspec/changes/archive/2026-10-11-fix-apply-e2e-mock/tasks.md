## 1. Fix the stale mock

- [x] 1.1 In `test/e2e/apply.spec.ts`, add `contacts: []` to the `listing()` mock, plus `id` and `avoidedAt: null` on `company`, matching the `ListingById` selection in `app/composables/useListing.ts`
- [x] 1.2 Check whether `pnpm typecheck` covers `test/e2e` (add a deliberate wrong field to the mock, run it, revert). If it does, type the mock as `ListingDetail` (`import type` from `~/composables/useListing`, or a relative path if `~` doesn't resolve there) with `satisfies`, so a missing field fails typecheck. If not, skip this and note it

  Coverage check: `pnpm typecheck` passed with a temporary string `id` in a fixture using
  `satisfies ListingDetail`. E2E fixture errors are not covered; the probe and type import were
  removed. Retained the plain field fix as planned.

## 2. Checks

- [x] 2.0 Resolve the owner-approved unit setup failures by running the two standalone logic files
      in a Node Vitest project, preserving the Nuxt project for other tests and existing behavior
      assertions. Use explicit imports for existing dependencies and verify the 12 affected tests.

- [x] 2.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`

  Final typecheck and lint pass. After the unit setup fixes, `pnpm test` passes:
  30 files / 127 tests, none skipped. Targeted standalone tests: 12 passed;
  targeted query tests: 11 passed. Changed-file formatting passes.

- [x] 2.2 Run E2E for this spec only: `pnpm test:e2e test/e2e/apply.spec.ts` (owner OK'd an E2E run for this change), then the full `pnpm test:e2e` once; all 11 pass

  Targeted Apply E2E: 1 passed. Full E2E: 11 passed. Both production builds succeeded.
