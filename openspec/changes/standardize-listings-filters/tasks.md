## 1. Setup

- [ ] 1.1 Run `pnpm gql:gen` (expected no relevant diff); take before screenshots of `/listings` at 375, 768 and 1440 (light, guest/mock data) into the scratchpad.

## 2. Filter panel

- [x] 2.1 In `app/components/listings/FilterPanel.vue`, replace the pill row with inline Favorites and Preferred locations toggles beside search and Filters; show labels from `md`.
- [x] 2.2 Group the sheet: Status (status, show rejected), Location (Norway only, location), Role (Any/IT/Non-IT control keeping the exclusive rule), Language (posting, English posting, English mentioned, required), Skills, Dates (due, posted from/to). Show counts on the toggles.
- [x] 2.3 Shrink `outsideSheet` to favorites, preferredLocations, companyId; add chips for Norway only, Role, English posting and English mentioned.

## 3. Page layout

- [x] 3.1 In `app/pages/listings/index.vue`, order rows per the spec; keep Sort right of the view row, make tablet tabs scroll (`overflow-x-auto`) instead of colliding with Sort, and give phone a labelled View/Sort select pair with full-width search below.
- [x] 3.2 Keep the search box capped on desktop and wrapping sensibly on tablet.

## 4. Tests and docs

- [x] 4.1 Update `test/unit/FilterPanel.test.ts` (pills now in the sheet, Role exclusivity, chips for moved toggles, badge counts) and any page test using `listings-facet-*`; update `test/e2e/listings-search.spec.ts` selectors without running it.
- [x] 4.2 Update the `ListingsFilterPanel` entry in `docs/REUSABLES.md` and the filters line in `docs/STATUS.md`.

## 5. Verify

- [x] 5.1 Run the affected unit tests, `pnpm lint`, `pnpm typecheck`.
- [ ] 5.2 Build preview (`echo '{}' | .claude/hooks/preview.sh`), screenshot 375/768/1440 including the open sheet on phone with a text input focused; fix issues. E2E not run unless authorized.
