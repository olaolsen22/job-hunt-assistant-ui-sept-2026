# Proposal

## Why

On `/listings/quick-add` the owner pressed "Done" expecting it to save the new listings, but they had
already been saved without pressing "Save N listings". The page is one form whose Save button is the
submit button, so Enter in any row field saves every pending row. "Done" then replaces "Cancel" and
reads like a confirm, while it only navigates away, silently leaving any unsaved rows behind.

## What Changes

- Rows are saved only by clicking "Save N listings"; Enter in a row field no longer saves.
- "Cancel" / "Done" become one "Back to listings" action that never sounds like saving. When all
  rows are saved and none are pending, it becomes the primary "View listings" button and Save is hidden.
- Leaving with unsaved rows after something was saved asks for confirmation ("Leave N unsaved
  listings?" — saved listings are kept).
- After a save, a short status line next to the actions shows "N saved · M need fixing".
- The top summary ("Pasted N listings. Check them below, then save.") follows the state: it stops
  telling the user to save once everything is saved.

Out of scope:

- Reordering rows (failed rows first).
- A router-level leave guard (browser back, other links); only the page's own button confirms.
- Changing what a save does or the toast.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `listing-creation`: adds quick-add requirements for explicit saving, leaving the page, and the save status.

## Impact

- `app/pages/listings/quick-add.vue` only (template actions, a confirm, computed counts). No API change.
