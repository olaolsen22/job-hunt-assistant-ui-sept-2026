# Tasks

## 1. Plumbing

- [x] 1.1 In `useParsePrompt.ts`, add `companyParsePrompt` (query `companyParsePrompt { instructions }` aliased to `prompt`) and map it to `COMPANIES`. Verify: `pnpm typecheck`, and quick-add still loads its prompt.
- [x] 1.2 Add the `industries` lookup to `NameLookup` and `NameCombobox` `QUERIES` (names only, ordered by name, 20 per page). Verify: `pnpm typecheck`, and a unit test in `test/unit/` that the combobox with `lookup="industries"` lists the names returned by a `registerEndpoint('/graphql')` mock.
- [x] 1.3 In `useListingsList.ts`, seed `search` from `useRoute().query.search` when present. Verify: opening `/listings?search=bekk` shows "bekk" in the box and a filtered list; `/listings` is unchanged.

## 2. Companies list

- [x] 2.1 Consult the `ui-ux-designer` agent for the `/companies` layout (row content on phone and desktop, Prev / Next with "1–20 of N", empty state, "Add companies" placement) and the `/companies/add` preview row (name, industry, locations repeater, result card for existing companies). Verify: the agreed layout is written down before building.
- [x] 2.2 Add the "Companies" nav item in `app/layouts/default.vue` and `app/pages/companies/index.vue`: the `companies` connection (name, industry, locations, `listingCount`, `applicationCount`, `pageInfo`, `totalCount`), debounced search, Prev / Next with a cursor trail (design.md, decision 4), rows linking to `/listings?search=<name>`, and the empty state. Verify: `pnpm typecheck`, and with the dev server (the owner runs it) page forward, back, search resets to page one, and a row opens the filtered listings.
- [x] 2.3 Add a unit test for the list: renders rows from a mocked `companies` response and Next requests `after: <endCursor>`. Verify: `pnpm vitest run test/unit/<Name>.test.ts`.

## 3. Add companies

- [x] 3.1 Build `app/pages/companies/add.vue`: paste card (built-in parser or copy prompt + JSON reply), summary line with "Paste more", reply sanitizing (`toRow` for `{ name, industryName, locations }`, drop unknown country codes), and silent validation straight after parsing. Verify: pasting a fenced JSON array adds rows, and a row with no name shows "Required" without clicking Save.
- [x] 3.2 Add the editable row card: `ListingsNameCombobox` for name and for industry, `ListingsLocationsField` for locations, remove button, and "Add row". Verify: all three fields edit, and a typed industry shows the "New, will be created" hint.
- [x] 3.3 Add Save: one `createCompanies` call, result cards with "Already existed, left unchanged" when `created` is false, one error banner above the rows on any API error with rows kept, success toast counting only new companies, `clearNuxtState('name-lookups')`, and "Done" back to `/companies`. Verify: with a mocked response of one new and one existing company the cards and toast read correctly, and with a mocked `InvalidLocationError` nothing turns into a card.
- [x] 3.4 Add one unit test for the add page happy path (paste reply, preview rows, save, result cards). Verify: `pnpm vitest run test/unit/<Name>.test.ts`.

## 4. Wrap-up

- [x] 4.1 Add one e2e in `test/e2e/` with `page.route` mocks: paste a reply, fix a row, save, see the result cards. Verify: `pnpm test:e2e` passes (the owner runs it).
- [x] 4.2 Update `docs/REUSABLES.md` (industries lookup, `useParsePrompt` company prompt) and run `/log-progress` for `docs/STATUS.md`. Verify: both list the new pages and the added lookup.
- [x] 4.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`. Verify: all pass.
