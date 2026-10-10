# Proposal

## Why

When quick-add flags a saved row as a possible duplicate, the warning shows only the title, company
and role of each match. That isn't enough to decide between "Keep both" and "Remove this one"
without opening the existing listing in another tab.

## What Changes

- Each match in the quick-add "Possible duplicate" note gets a **Compare** button.
- Compare opens a modal that puts the new (just-saved) listing next to the existing match, one row
  per field: title, company, role, URL, locations, posted, deadline, and the existing listing's
  status. Rows that differ are highlighted.
- On wide screens the two values sit side by side ("New" on the left, "Existing" on the right). On
  phones each row stacks the two values under the field label, each tagged New / Existing.
- With 2+ matches, a "Compare with" selector inside the modal switches the existing side.
- The modal footer offers Open existing (new tab), Keep both, and Remove new one (the existing
  confirm-then-delete flow).
- The save response asks for the extra fields on both the new listing and its matches, so comparing
  needs no extra request.

Out of scope:

- Merging fields between the two listings or editing either one from the modal.
- Comparing on the full `/listings/add` form (it doesn't show possible duplicates today).
- Skills, languages, description and other fields quick-add never fills.
- Hiding identical rows behind a toggle.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `listing-creation`: adds a requirement for comparing a quick-add row with its possible duplicates.

## Impact

- `app/pages/listings/quick-add.vue`: larger result fragment, Compare buttons, modal wiring.
- New `app/components/listings/CompareModal.vue`.
- No API change; all fields already exist on `Listing`.
