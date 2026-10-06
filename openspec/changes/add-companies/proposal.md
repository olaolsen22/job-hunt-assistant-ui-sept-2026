# Proposal

## Why

The API has a full companies feature (`companies`, `createCompanies`, `companyParsePrompt`, and `parseListing(mode: COMPANIES)`), but the UI only touches company names as a field on a listing. There is no way to see the companies you have, or to add several at once with their industry and locations (for example from a pasted list of names).

## What Changes

- New **companies list** at `/companies`: name, industry, locations, listing count and application count. Search box and Prev / Next paging. Each row links to `/listings?search=<name>`. An "Add companies" button leads to the add page.
- New **add companies** page at `/companies/add`, shaped like quick-add listings:
  - Input: "Use built-in parser" checkbox (`parseListing(mode: COMPANIES)`) or copy-paste prompt (`companyParsePrompt`) and paste the AI's JSON array. "Paste more" appends rows.
  - Preview: one editable row per company with name, industry and locations, validated as soon as the rows appear, before anything is saved. Rows can be removed, and a blank row added by hand.
  - Save: one `createCompanies` call for all rows (the API is all-or-nothing). Each row then becomes a result card; a company that already existed says "Already existed, left unchanged".
  - Name and industry use the existing type-or-pick combobox; locations use the existing locations repeater.
- Nav entry "Companies" in the default layout.
- `useParsePrompt` also supports the company prompt and the `COMPANIES` parse mode.
- `NameCombobox` gains an `industries` lookup.

Out of scope:

- Editing a company (`updateCompany`) and any company detail page.
- Deleting a company (the API has no `deleteCompany`), so saved result cards have no remove button.
- Filtering the list by industry or location, and sorting other than name ascending.
- Numbered pages (the `companies` query is cursor-based only).
- Filtering `/listings` by company; the list link uses the existing free-text search.
- Any API change.

## Capabilities

### New Capabilities

- `company-management`: browsing the companies list and adding companies in bulk with a preview.

### Modified Capabilities

None.

## Impact

- New `app/pages/companies/index.vue` and `app/pages/companies/add.vue`; possibly a small `app/composables/useCompaniesList.ts` if the page logic outgrows the page.
- `app/layouts/default.vue`: nav item.
- `app/composables/useListingsList.ts`: the initial `search` is read from `?search=` so the company link works (it is a local `ref` today; nothing else about the URL changes).
- `app/composables/useParsePrompt.ts`: `companyParsePrompt` query and `COMPANIES` mode.
- `app/components/listings/NameCombobox.vue` and `app/composables/useNewNames.ts`: `industries` lookup. The companies pages use `<ListingsNameCombobox>` and `<ListingsLocationsField>` where they are, without moving them.
- `docs/STATUS.md`, `docs/REUSABLES.md`, `test/e2e/` (a `createCompanies` mock for the add flow), `test/unit/`.
- `useListingsList.ts` also carries uncommitted `listings-filters` work; commit or finish that first to keep the two changes apart.
- Assumption: Prev / Next paging (the pagination question was not answered); Load more is a small swap if preferred.
