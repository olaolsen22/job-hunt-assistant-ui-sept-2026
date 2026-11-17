# Backlog

Known bugs, refactors and deferred features that are not part of the current branch. Remove an
item once it ships; feature status lives in `STATUS.md`.

## API features the UI doesn't use yet

Checked against the schema on 2026-11-06. `updateListing` is a full replace, so a field the form
doesn't send is cleared; only `contacts` and `trainingProgram` are kept when omitted.

- Training programs: `Listing.trainingProgram` and `ListingInput.trainingProgram` (a value in a parse
  reply or an import file is dropped), plus the `listings(isTrainingProgram:)` filter.
- Job-role categories: `jobRoleCategories` and create, update and set mutations. Parses and imports
  send `jobRoleCategoryName`, but the form has no control for it. The listings "IT" toggle already
  filters by category name.
- Usage history: `usageDaily(days, credentialId)`. The dashboard shows today only.
- Unsolicited applications (`ListingKind.UNSOLICITED`: no ad link, posting date or due date). The UI
  shows them and keeps the kind on save, but can't create one: the form requires an ad link.

## Features / UX

- Tailored CV page, phase 2 of the redesign (phase 1 is the `redesign-tailored-cv-page` change; the
  ux-designer proposed it on 2026-11-16):
  - Show the content as one page that looks like a CV: name, headline, contact line, then sections
    in `sectionOrder`, with grouped skills and technologies under the Developer layout. Small action
    buttons per section and entry. Label it "Layout is approximate. The PDF is the final version."
    No live PDF preview, because every `generateCvDocument` call creates a document.
  - Job requirements panel from `requirementMap(listingId)`:
    - Needs grouped Gaps / Partly covered / Covered, with counts and text labels.
    - A sticky right column at ≥xl; a "Requirements (N)" slideover below that.
    - With no map: "No requirement map yet" plus a link to `/listings/[id]/requirements`.
    - Probably possible: mark bullets with the need they cover. `RequirementNeed.bulletIds` refers to
      the same profile bullets as `sourceBulletId`.
  - Replace the blurred whole-CV overlay with an `AppAiModal` step list (done / running / waiting).
    Add "Stop after this step": the run is a browser loop, one request per step, so it can stop between
    steps and keep the finished results for review.
  - "Edit, then accept" on a suggestion: open the entry modal prefilled with the suggested content.
- Retry-confirm checkbox; revisit the "Use reply" label.
- Group review rows in the CV import review.
- Bulk manual translation: the API now has `applyProfileTranslation`, so this is no longer blocked.
- Listing page: the tailored CV and cover letter cards fetch their drafts only after the listing
  loads (one round trip later). Starting them earlier needs the cards to reuse a finished fetch,
  which the current cache options can't do safely.
