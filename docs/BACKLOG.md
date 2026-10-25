# Backlog

Known bugs, refactors and deferred features that are not part of the current branch. Remove an
item once it ships; feature status lives in `STATUS.md`.

## API features the UI doesn't use yet

Checked against the schema on 2026-10-24. Omitted fields keep their saved values, so none of these
is changed by a UI save.

- Training programs: `Listing.trainingProgram` and `ListingInput.trainingProgram`, plus the
  `listings(isTrainingProgram:)` filter.
- Job-role categories: `jobRoleCategories` and create, update and set mutations. The parse prompts
  also suggest `jobRoleCategoryName`, which the form drops. The listings "IT" toggle already filters
  by category name.
- Usage history: `usageDaily(days, credentialId)`. The dashboard shows today only.
- Unsolicited applications (`ListingKind.UNSOLICITED`: no ad link, posting date or due date). The UI
  shows them and keeps the kind on save, but can't create one: the form requires an ad link.

## Features / UX

- Retry-confirm checkbox; revisit the "Use reply" label.
- Group review rows in the CV import review.
- Bulk manual translation: the API now has `applyProfileTranslation`, so this is no longer blocked.
- Listing page: the tailored CV and cover letter cards fetch their drafts only after the listing
  loads (one round trip later). Starting them earlier needs the cards to reuse a finished fetch,
  which the current cache options can't do safely.
