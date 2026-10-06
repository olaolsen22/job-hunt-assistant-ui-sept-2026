# Proposal

## Why

The companies list (`add-companies`) pages with Prev / Next only. `/listings` has numbered pages, so
the two lists feel different and there is no way to jump to a page.

## What Changes

- `/companies` uses the same numbered pager as `/listings` (`UPagination`), replacing Prev / Next and
  the "x-y of z" label.
- The `companies` query keeps its cursor API (`first/after`, `endCursor`, `hasNextPage`). The pager
  remembers the `after` cursor of every page it has seen; jumping past those walks forward one page at
  a time until the target page is reached.
- Search and any change still go back to page 1.
- Page size follows the `/listings` rule (`measurePageSize`: 5 on phones, otherwise as many rows as fit the screen, max 12) instead of a fixed 20.

Out of scope:

- Any API change (no `skip` / offset on `companies`). `first` is capped at 50 (`@listSize(assumedSize: 50)`), so loading `N * pageSize` rows in one request is not an option.
- Sorting other than name ascending.
- Changing the `/listings` pager.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `company-management`: the "Companies list" requirement says numbered pages instead of Previous / Next.
  This spec is still a delta in the unarchived `add-companies` change, so that change must be archived
  first or the MODIFIED delta has nothing to modify.

## Impact

- `app/pages/companies/index.vue` only (query, paging state, pager markup).
- `test/unit/CompaniesList.test.ts` (and the e2e if it clicks Next), `docs/STATUS.md`.
- Assumption: numbered pages were chosen over Load more / screen-fit size by the owner.
