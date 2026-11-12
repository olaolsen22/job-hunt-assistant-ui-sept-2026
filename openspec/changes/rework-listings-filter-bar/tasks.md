## 1. Rework the bar

- [x] 1.1 In `app/components/listings/FilterPanel.vue`, remove the Favorites/Preferred buttons from the search row; make search `flex-1 min-w-0` with Filters `shrink-0` beside it.
- [x] 1.2 Add the quick-filter row: seven pills from one array, exclusive IT/Non-IT, phone scroll line, `md` wrap and label.
- [x] 1.3 Extend `outsideSheet`; remove the chips and sheet switches for Norway, Role and English toggles and the `role` computed; keep the sheet groups.
- [x] 1.4 In `app/pages/listings/index.vue`, make Sort's right edge match Filters' (classes only).

## 2. Tests and docs

- [x] 2.1 Update `test/unit/FilterPanel.test.ts`: pills with counts and aria-pressed, IT/Non-IT exclusivity, pills not counted or chipped, sheet Clear keeps pills, Clear all resets them.
- [x] 2.2 Update `docs/REUSABLES.md` (`ListingsFilterPanel`) and the `/listings` line in `docs/STATUS.md`.

## 3. Verify (before declaring done)

- [x] 3.1 Run the FilterPanel tests, `pnpm lint`, `pnpm typecheck`; build preview.
- [x] 3.2 Screenshot with mock data at 375, 768, 1024, 1152, 1280, 1440 and look at each: no clipping or sideways page scroll, pills wrap/scroll as specified, Sort and Filters aligned, phone sheet opens. Fix and re-shoot before reporting.
