# Proposal

## Why

The API now lets a company be marked as avoided (`avoidedAt`, `setCompanyAvoided`) and given free-form
Markdown notes (`notes`, `setCompanyNotes`), where the reason for avoiding goes. The UI has nowhere to
show or set either. A company row today only jumps to a `/listings` search, so there is also no place
to see one company's positions and history, or to edit a company after it was added.

## What Changes

- New `/companies/[id]` page with:
  - a header (name, favorite, industry, Avoided badge, locations) and actions: Edit, plus a More menu
    with Avoid / Stop avoiding
  - a stats card derived from the company's listings
  - one Positions list with every listing at the company, archived ones included
  - a Notes card that renders the Markdown and edits it in a modal
- New `/companies/[id]/edit` page for name, industry and locations, using `updateCompany`.
- Avoiding asks for confirmation; stopping does not. An avoided company shows an "Avoided" notice and
  badge on its page and rows. Its listings show an "Avoided company" badge on their cards and listing
  page, and stay visible everywhere.
- `/companies`:
  - a "Hide avoided" toggle, off by default and kept in the URL
  - rows link to `/companies/[id]` instead of the `/listings` search, and show the Avoided badge
  - the row's favorite star no longer sits inside the row link
- **BREAKING (UI behavior)**: clicking a company row no longer opens `/listings?search=<name>`.

Out of scope:

- Notes or avoid on `/companies/add` (bulk add stays as it is).
- Hiding avoided companies' listings from `/listings` or the dashboard.
- Avoided badges in dashboard widgets.
- A count on the Hide avoided toggle.
- Stats that need per-listing status history.
- Deleting companies (no API for it).

## Capabilities

### New Capabilities

- `company-details`: the company page (header, stats, positions, notes), editing a company, marking
  it avoided, and showing the avoided mark on its listings.

### Modified Capabilities

- `company-management`: the Companies list gets the Hide avoided toggle and the Avoided badge, and its
  rows link to the company page. The favorite requirement's "row link" scenario now refers to that page.

## Impact

- Pages:
  - new `app/pages/companies/[id]/index.vue` and `app/pages/companies/[id]/edit.vue`
  - changed `app/pages/companies/index.vue` and `app/pages/listings/[id]/index.vue`
- Components and composables:
  - `app/components/listings/Card.vue`
  - `app/components/dashboard/Row.vue` (prop rename `company` → `subtitle`)
  - the `ListingListItem` fragment in `useListingsList.ts` and the query in `useListing.ts` (add
    `company { id avoidedAt }`)
  - a `useCompaniesView` Back helper next to `useListingsView`
- GraphQL: new uses of `setCompanyAvoided`, `setCompanyNotes` and `updateCompany`. Run `pnpm gql:gen`
  first to pick up the new schema fields.
- No new packages: Markdown uses the existing `AppMarkdownContent` / `AppMarkdownEditor`.
