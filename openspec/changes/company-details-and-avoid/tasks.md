# Tasks

## 1. Prep

- [x] 1.1 UX input from `ui-ux-expert` for the company page, edit page, avoid and Hide avoided (done while proposing; its recommendations are in design.md)
- [x] 1.2 Run `pnpm gql:gen` so `app/graphql-env.d.ts` has `avoidedAt`, `notes`, `setCompanyAvoided` and `setCompanyNotes`; verify with `pnpm typecheck`

## 2. Avoided mark on listings

- [x] 2.1 Add `company { id avoidedAt }` to the `ListingListItem` fragment (`useListingsList.ts`) and the `ListingById` query (`useListing.ts`); verify with `pnpm typecheck`
- [x] 2.2 Show the "Avoided company" badge (warning, subtle, `i-lucide-ban`) in `ListingsCard` and the listing page header, and link the company name on the listing page to `/companies/<id>`; extend `ListingPage.test.ts` with one avoided case

## 3. Companies list

- [x] 3.1 Switch company rows to the stretched-link pattern pointing at `/companies/<id>`, with the favorite on `relative z-10`; add the Avoided badge; update `CompaniesList.test.ts` for the new link
- [x] 3.2 Add the "Hide avoided" toggle: a `hideAvoided` query flag, the filter spliced into the query text, reset of page and cursors, and the empty message when on; add `useCompaniesView` and set it on URL changes; test toggle → filtered request + URL in `CompaniesList.test.ts`

## 4. Company page

- [x] 4.1 Rename `DashboardRow`'s `company` prop to `subtitle` and update the call sites; `pnpm typecheck` and `DashboardWidgets.test.ts` pass
- [x] 4.2 Create `app/pages/companies/[id]/index.vue` with the `CompanyPage` query (company, plus open and archived listings in one request), Back via `useCompaniesView`, the header (name, favorite, industry, Avoided badge, locations), Edit, a More menu, skeletons, and not-found/error alerts; new `CompanyPage.test.ts` for the header and not-found cases
- [x] 4.3 Add the stats card and the Positions list (status-rank sort, archived last with badge, empty state with Add listing); test ordering and counts in `CompanyPage.test.ts`
- [x] 4.4 Add the Notes card (`LazyAppMarkdownContent`, empty state) and the notes modal (`AppMarkdownEditor`, `setCompanyNotes`, API error inline, modal stays open); test saving notes
- [x] 4.5 Add avoid / stop avoiding (More menu item, `AppConfirmModal` for avoid only, avoided notice with Stop avoiding, `useMutation` + toast); test confirm → `setCompanyAvoided` sent and badge shown

## 5. Edit page

- [x] 5.1 Create `app/pages/companies/[id]/edit.vue`: prefilled name (`UInput`), industry (`ListingsNameCombobox lookup="industries"`) and locations (`ListingsLocationsField`); `updateCompany` with the `toInput` mapping from `add.vue`; errors shown inline; Cancel/Back; on save clear `name-lookups`, refresh the company page and use the replace-or-back flow from the listing edit page; test save → navigation and an error case

## 6. Wrap-up

- [x] 6.1 Update `.claude/state/ui-inventory.md` (company pages, `useCompaniesView`, `DashboardRow` `subtitle`, MarkdownContent/MarkdownEditor descriptions) and `docs/REUSABLES.md` where props changed
- [x] 6.2 Run `pnpm typecheck`, `pnpm lint` and `pnpm test`; all pass (E2E not run)
- [ ] 6.3 `pnpm build` + `pnpm preview --port 3000`, ask the owner for a live check, then `/log-progress`
