# Tasks

## 1. Refresh after save

- [x] 1.1 In `app/pages/listings/[id]/edit.vue`, `await refreshNuxtData(`listing-${id}`)` after a successful save and before `navigateTo`
- [x] 1.2 Add a unit test (next to `ListingSaveNavigation.test.ts`): the listing query is requested again after a successful save

## 2. Checks

- [x] 2.1 Run the new test, `pnpm lint`, `pnpm typecheck`; then `pnpm build` and `pnpm preview --port 3000` (E2E not run)
- [x] 2.2 Owner live check: open a listing, Analyze, paste the ad, save, and see the updated values without refreshing
