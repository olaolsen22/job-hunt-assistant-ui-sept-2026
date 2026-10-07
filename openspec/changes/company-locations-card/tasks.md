# Tasks

## 1. Design check

- [x] 1.1 Quick `ui-ux-expert` check of the card's placement (right column, above Notes) and the preferred indicator (`i-lucide-target` in `text-primary` with a "Preferred location" `UTooltip`, plus screen-reader text); done when its advice is applied or noted here. Advice taken: keep it above Notes; use a small `Preferred` badge (`shrink-0`, after the label), not a tooltip icon, since tooltips don't work on touch; share the label formatting with `ListingsLocation`; two right-column skeletons

## 2. Locations card

- [x] 2.1 In `app/pages/companies/[id]/index.vue`, finish the partly written card: query `id isTarget` on company locations and `locations { location { id } }` on both listing fields; a `formatLocation` util shared with `ListingsLocation`; a `locations` computed, per-location listing counts from the merged positions, and the sort (preferred → count desc → name via `localeCompare`); rows with a small `Preferred` badge instead of the draft's `Target` badge; a second right-column skeleton; empty state linking to Edit; header locations line removed. Verify with `pnpm typecheck`
- [x] 2.2 Update `test/unit/CompanyPage.test.ts`: give fixtures location ids/`isTarget` and listing locations; move the header "Oslo, NO" assertion to the card; add one test for counts, the order (Bergen, Oslo, Stockholm) and the indicator on the preferred row only. `pnpm vitest run test/unit/CompanyPage.test.ts` passes

## 3. Wrap-up

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test`; all pass (E2E not run)
- [x] 3.2 `pnpm build` + `pnpm preview --port 3000`, and ask the owner for a live check together with `company-details-and-avoid`
