# Proposal

## Why

The UI's GraphQL types were last generated on 2026-09-27. Since then the backend shipped six
contract changes (2026-10-05). Two of them break the UI: `ROLLING` was removed from `DeadlineType`,
and `ACCEPTED` was added to `ApplicationStatus`. With `ACCEPTED`, `APPLICATION_STATUS_OPTIONS.find(...)!`
returns `undefined` and the status badge and timeline crash. The other changes are features the
backend added for the UI (server-owned due date, search, closing-soon filter, previous attempts),
and today the UI duplicates or misses them.

## What Changes

- Regenerate `app/graphql-env.d.ts` from the current `schema.graphql`.
- **BREAKING** Remove the `ROLLING` deadline type from the UI. A parsed draft that still says
  `ROLLING` is mapped to `ASAP`, as the backend's STATUS.md recommends.
- **BREAKING** Support the `ACCEPTED` status and outcome. An `OFFER` can now end as accepted,
  rejected (the company withdrew the offer), or withdrawn (the user declined).
- Undo of a final step can now fail with `DuplicateListingError`. Show its message plus a link to
  the open listing that has the same URL.
- `ListingsDates` uses the server's `Listing.dueOn` instead of the hardcoded ASAP + 14 days rule.
  `UNSPECIFIED` listings now show a due date too (posted + 30 days), matching the server's sort.
- Update the stale default-order comment in `useListingsList`.
- Show `previousAttempts` ("you applied to this before") after saving on add and quick-add,
  with links to the earlier listings.
- Add a search box to `/listings` (`listings(search)`), which combines with the active filter.
- Add a "closing soon" filter to `/listings` (`listings(dueWithinDays)`).

### Out of scope

- Any API change. The frontend only follows the contract.
- The parse queue and `onParseJobUpdated` over SSE (backend "Next up", not shipped yet).
- Date-range filters on `postedOn`/`deadlineOn`, and searching descriptions (the API doesn't support it).
- Grouping or merging the history of earlier attempts on the listing detail page. This change only
  links to them.
- Reworking the "expired listings are hidden" rule. The list keeps hiding past `DATE` deadlines.

## Capabilities

### New Capabilities

- `listing-deadlines`: deadline types a listing can have, and how its due date and urgency are shown.
- `application-tracking`: application statuses, allowed outcomes per status, and undoing status changes.
- `listing-browsing`: the `/listings` page's filters, search, ordering, and pagination.
- `listing-creation`: adding listings (form, quick-add, parsed drafts) and the duplicate and previous-attempt warnings.

### Modified Capabilities

None. `openspec/specs/` is empty, so every capability above is new.

## Impact

- Generated types: `app/graphql-env.d.ts`.
- Constants: `app/constants/listing.ts` (`DEADLINE_TYPE_OPTIONS`, `APPLICATION_STATUS_OPTIONS`, `OUTCOME_OPTIONS`).
- Components: `listings/Dates.vue`, `listings/Application.vue`, `listings/OutcomeModal.vue`,
  `listings/StatusBadge.vue`, `listings/StatusTimeline.vue`.
- Composables: `useListingsList.ts` (fragment, queries, filter, search), `useListing.ts` (`dueOn`),
  `useListingForm.ts` (ROLLING → ASAP in parsed drafts).
- Pages: `listings/index.vue` (search, closing-soon filter), `listings/add.vue` and
  `listings/quick-add.vue` (previous attempts).
- Tests: e2e mocks that use `ROLLING` (`quick-add.spec.ts`, `apply.spec.ts`); unit tests for `Dates` and the outcomes logic as needed.
- Docs: `docs/REUSABLES.md` (`ListingsDates` description, `useListingsList`).
- No new packages.
