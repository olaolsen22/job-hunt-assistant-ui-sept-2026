# Tasks

## 1. Design check

- [x] 1.1 Confirm the layout with ui-ux-expert against design.md (row-per-field grid, stacked on phones, footer actions); note any change in design.md

## 2. Data

- [x] 2.1 Extend `RESULT_FRAGMENT` in `quick-add.vue` with the compare fields on `listing` and `possibleDuplicates`; verify with `pnpm typecheck`

## 3. Compare modal

- [x] 3.1 Add `app/components/listings/CompareModal.vue` (rows, difference marking, `—` for empty, "Compare with" select for 2+ matches, footer emitting `keep` / `remove`); verify the unit test below
- [x] 3.2 Add `test/unit/ListingsCompareModal.test.ts` (`mountSuspended`): differing row is marked, selector hidden with one match and switches values with two, Keep both / Remove new one emit; verify with `pnpm vitest run test/unit/ListingsCompareModal.test.ts`

## 4. Quick-add wiring

- [x] 4.1 Add a Compare button to each match in the possible-duplicate note and open the modal with that match; wire `keep` to dismiss the note and `remove` to close the modal then `askRemove(row)`; verify by typecheck and a manual check (UI unverified unless the owner allows a live check)
- [x] 4.2 Add `ListingsCompareModal` to `.claude/state/ui-inventory.md` and `docs/REUSABLES.md`

## 5. Wrap-up

- [x] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; all pass
- [x] 5.2 Run `/log-progress` to update `docs/STATUS.md`
