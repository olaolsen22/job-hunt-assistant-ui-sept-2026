# Proposal

## Why

After a quick-add save, Compare is a small link inside the possible-duplicate note, even though comparing
is the main thing to do with a flagged row. Saved rows also render as one long list, so the few that need
a look get lost among the clean ones.

## What Changes

- The possible-duplicate note gets one primary **Compare** button first in its actions (opening the
  first match; the modal's "Compare with" switches matches). The per-match Compare links go away.
- "Keep both" matches the modal's neutral style; "Remove this one" becomes "Remove new one", as in the modal.
- A saved row flagged only "Applied to this URL before" gets a **Got it** button that clears the flag.
- After a save the page groups rows:
  1. **Needs a look (N)**: saved rows with an open flag, shown in full as today.
  2. **N listings added**: saved rows with no open flag, in one collapsible group (closed by default),
     each as a compact title + company · role line.
  3. **Not saved (N)**: rows still to save or fix, kept right above Save.
- Resolving a flag (Keep both, Got it) moves the row into the added group; Remove deletes it as today.
- Match and previous-attempt title links open in a new tab, so following one keeps the page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-creation`: Compare becomes the note's main action (modifies "Compare a quick-add row with a
  possible duplicate", from `quick-add-duplicate-compare`), and saved quick-add rows are grouped by
  whether they still need a look.

## Out of scope

- Any API change; flags come from the existing `createListing` result.
- Changes to the compare modal itself, the paste step, or the row edit fields.
- Persisting the groups or the collapsed state beyond the page.

## Impact

- `app/pages/listings/quick-add.vue` (template and a few computeds; no new state store).
- `test/unit/QuickAdd.test.ts` (selectors and new grouping tests).
- Depends on `quick-add-duplicate-compare` being archived first, since this modifies its requirement.
