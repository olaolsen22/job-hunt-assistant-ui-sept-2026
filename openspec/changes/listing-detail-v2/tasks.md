# Tasks

## 1. Data and page shell

- [x] 1.1 Add `app/composables/useListingOverview.ts`: literal `graphql()` `listingById` document
      with every field the spec shows (incl. company details, `jobRole.category`,
      `locations.isTarget`, `trainingProgram`, `createdAt`, `statusChangedAt`,
      `documents.sizeBytes`), `ListingOverview` type via `ResultOf`, and `useListingOverview(id)`
      following `useListing`'s pattern (key `listing-overview-<id>`, `server: false`). Verify with
      `pnpm typecheck` (no unknown fields).
- [x] 1.2 Add `app/pages/listings/v2/[id].vue`: start `useListingOverview` and
      `useRequirementMapQuery` together, skeleton while loading, not-found and error states with
      "Back to listings" and Try again, archived notice, container-query grid (1 / 2 / 3 columns at
      `@5xl` / `@7xl`) in DOM order. Verify in `test/unit/ListingOverviewPage.test.ts`
      (`mountSuspended` + `registerEndpoint` on `/graphql`): renders title for a listing, shows
      not-found, shows error with Try again; and that `/listings/[id]` tests still pass.

## 2. Header, facts and training

- [x] 2.1 `ListingOverviewHeader`: back link, title, "Company · Role", status / kind (non-vacancy) /
      favorite / archived / avoided badges, deadline via `dueSummary` + `deadlineLevel` +
      `URGENCY_TEXT`, "View original posting" (new tab) only with a url. Verify page test cases:
      badges for a favorited APPLIED listing, no posting link when url is null, ASAP shows "~".
- [x] 2.2 `ListingOverviewFacts`: label-above-value items for set facts only, "Target" on target
      locations, "Part time, 80 %" schedule format, strip hidden when empty. Verify page test:
      unset seniority/work mode produce no item and no "Not stated".
- [x] 2.3 `ListingOverviewTraining`: shown only with a training program; paid and job-offer labels.
      Verify page test: guaranteed paid program shows both; absent program renders nothing.

## 3. Requirements

- [x] 3.1 `ListingOverviewRequirements` with a saved map: Required then Preferred groups, gap →
      partial → evidenced order, kind label, match badge (icon + word, error/warning/success),
      note, per-group counts via `matchCounts`, stale hint via `requirementMapStale`, own skeleton
      while the map loads. Verify page test: order and summary text for a mixed map; stale hint.
- [x] 3.2 Fallback without a map: skills ("Level n of 5", min years, Must-have / Nice-to-have,
      must-haves first), languages (CEFR, required), no-map note; "Couldn't load the requirement
      map" when that query fails; "No requirements extracted yet" / "No requirements found" when
      empty. Verify page test: null map lists skills; never-analyzed empty listing shows the
      not-extracted line.

## 4. Description, progress and side sections

- [x] 4.1 Description in the page: `whitespace-pre-line`, `max-w-prose`, `line-clamp` preview with
      "Show full description" only when it overflows; no-description message linking the posting.
      Verify page test: no-description text with link.
- [x] 4.2 `ListingOverviewProgress`: status history newest first ("No status changes yet" when
      empty), interviews upcoming first, questions with "Not answered yet"; notes via
      `LazyAppMarkdownContent`; empty interview/question lists hidden. Verify page test: upcoming
      interview listed before a past one; unanswered question text.
- [x] 4.3 `ListingOverviewCompany`, contacts via `CompaniesContactList` (read-only), and
      `ListingOverviewDocuments` (kind, origin, file name, size, created, "Sent <date>"); empty
      Contacts/Documents hidden, unset company fields omitted. Verify page test: sent tailored CV
      row; no Contacts section when empty.
- [x] 4.4 `ListingOverviewRecordDates` (muted; created, updated, analyzed, status changed when set)
      and phone accordion wrapping (Progress, Documents, Contacts, Company with counts) via
      `useMediaQuery`. Verify page test: no Analyzed date when never analyzed.

## 5. Checks and visual verification

- [x] 5.1 Run `pnpm vitest run test/unit/ListingOverviewPage.test.ts test/unit/ListingPage.test.ts`,
      `pnpm lint` and `pnpm typecheck`; all pass.
- [x] 5.2 Build and restart preview (`echo '{}' | .claude/hooks/preview.sh`); screenshot
      `/listings/v2/<id>` (guest account or mocked `/api/auth/me` + `/graphql`) at 375, 768, 1440,
      1920 and 2560, light mode, sidebar open and collapsed at 1440/1920, plus one dark-mode
      shot; save to the scratchpad. Confirm column switches, line length and long-title wrapping.
- [x] 5.3 Run `ui-reviewer` on the diff with the screenshots; fix confirmed issues, report the rest.
- [x] 5.4 Update `.claude/state/ui-inventory.md` with the new composable (reusable export) and
      log progress with `log-progress`.
