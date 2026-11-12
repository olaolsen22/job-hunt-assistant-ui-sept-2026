# Proposal

## Why

The current listing page grew around editing, AI actions and cards added one at a time, so the
information a job seeker needs first (is this worth my time, when is it due, where am I) is
spread out. A clean-slate, read-only v2 lets the layout be designed around reading the listing,
without disturbing v1 while it is still in use.

## What Changes

- New read-only page at `/listings/v2/[id]`, designed from the listing data alone rather than
  the existing screen. v1 at `/listings/[id]` stays unchanged and remains the page every link
  points to.
- Header: title, company and role, status and read-only favorite / archived / avoided-company
  badges, the deadline and the owner's own due date, and a "View original posting" link.
- Facts strip with the role facts that are set (locations with target marker, work mode,
  employment type, schedule and percent, seniority, posted date, posting language).
- Requirements section: the saved requirement map grouped by importance with match badges and a
  summary count; when no map is saved, a plain list of the listing's skills and languages.
- The ad description (collapsed, readable line length), application progress (status history,
  interviews, application questions), training program, company, contacts, documents, and muted
  record dates.
- Layout tuned for phone, tablet, desktop and wide screens (1, 2 and 3 columns), within the app's
  existing page width cap.
- No editing, status changes, AI runs, favorite toggles, downloads or other actions.

## Capabilities

### New Capabilities

- `listing-overview`: the read-only overview of one job listing at `/listings/v2/[id]`, what it
  shows, in what order, and how it adapts to screen width and missing data.

### Modified Capabilities

None. `listing-page` (v1) keeps its requirements; v2 replaces it only in a later change.

## Impact

- New page `app/pages/listings/v2/[id].vue` and a few page-specific components under
  `app/components/listingOverview/`.
- One new GraphQL read of `listingById` with the extra fields v2 shows, plus the existing saved
  requirement map query. No mutations, no API changes.
- Reuses existing badges, date/urgency utils and option labels; v1 code is not modified.
- No new packages.
