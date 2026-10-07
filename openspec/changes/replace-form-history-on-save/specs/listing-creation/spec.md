# Spec Delta

## ADDED Requirements

### Requirement: Saved forms leave no history entry

After a successful save, the add and edit listing forms SHALL be replaced in browser history by the
page they navigate to, so Back does not return to a form that was already submitted.

#### Scenario: Back after saving an edit

- **WHEN** the user opens a listing from a filtered list, edits it, saves, and presses browser Back on the details page
- **THEN** the filtered list is shown, not the edit form

#### Scenario: Back after adding a listing

- **WHEN** the user adds a listing and is redirected to `/listings`, then presses browser Back
- **THEN** the page before the add form is shown, not the add form
