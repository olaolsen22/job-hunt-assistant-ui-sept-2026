# Proposal

## Why

After saving an edited listing, browser Back reopens the edit form instead of going on to the
filtered listings view, so the user lands in a form they just finished and has to back out twice.
Adding a listing has the same problem: Back after the redirect to `/listings` reopens the add form.

## What Changes

- Saving the edit form replaces the edit page in history with the listing details page.
- Saving the add form replaces the add page in history with `/listings`.
- Back from the details page (and from the list after adding) skips the finished form.

### Out of scope

- The sidebar "Job listings" link and the post-add redirect still open the default (unfiltered) list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `listing-creation`: leaving the add or edit form after a successful save no longer keeps the form in history.

## Impact

- `app/pages/listings/[id]/edit.vue`, `app/pages/listings/add.vue` (one `navigateTo` option each)
- A unit test per page asserting the navigation is a replace. No API changes.
