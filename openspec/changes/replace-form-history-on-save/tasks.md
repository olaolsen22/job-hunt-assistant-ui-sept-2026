# Tasks

## 1. Replace the form entry on save

- [x] 1.1 In `app/pages/listings/[id]/edit.vue`, call `navigateTo(`/listings/${id}`, { replace: true })` after a successful save; verify with a unit test that the save navigates with `replace: true`
- [x] 1.2 In `app/pages/listings/add.vue`, call `navigateTo('/listings', { replace: true })` after a successful add; verify with a unit test that the add navigates with `replace: true`

## 2. Checks

- [x] 2.1 Run the new tests, `pnpm lint` and `pnpm typecheck`; all pass (E2E not run)
- [ ] 2.2 Owner live check: filter, open a listing, edit, save, press Back, and land on the filtered list
