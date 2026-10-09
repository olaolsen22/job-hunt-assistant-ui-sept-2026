## MODIFIED Requirements

### Requirement: Editing the dashboard

An "Edit dashboard" action SHALL switch the page to an edit mode that lists all ten widgets, including hidden
ones, in the current order. Each row SHALL let the user show or hide the widget and SHALL have a drag handle;
dragging a row by its handle SHALL reorder the list, with a placeholder marking where the row will land. Only the
handle starts a drag. A "Reset to default" action SHALL set the list to the
default order with every widget shown. Nothing is saved until the user clicks Save, including after a reset; Cancel SHALL
discard the changes. Save SHALL send the whole list in display order, then return to the dashboard with the saved
layout.

#### Scenario: Reordering

- **WHEN** the user opens edit mode, drags "To analyze" to the top and clicks Save
- **THEN** the full layout is saved with To analyze first and the dashboard shows it first

#### Scenario: Dragging from outside the handle

- **WHEN** the user presses on a row's label or switch and moves the pointer
- **THEN** the row is not dragged and the order is unchanged

#### Scenario: Hiding and showing

- **WHEN** the user hides "Stale listings" in edit mode and saves
- **THEN** the dashboard no longer shows it, and edit mode still lists it as hidden so it can be shown again

#### Scenario: Reset to default

- **WHEN** the user reorders and hides widgets, clicks "Reset to default", then clicks Save
- **THEN** the full layout is saved in the default order with all ten widgets shown

#### Scenario: Reset without saving

- **WHEN** the user clicks "Reset to default" and then Cancel
- **THEN** the dashboard keeps the previously saved layout

#### Scenario: Cancel

- **WHEN** the user changes the order and clicks Cancel
- **THEN** the dashboard keeps the previously saved order and visibility

#### Scenario: Save is rejected

- **WHEN** the API returns an error for the save
- **THEN** its message is shown, edit mode stays open, and the user's edits are kept

#### Scenario: Save fails

- **WHEN** the save request fails
- **THEN** a generic error is shown, edit mode stays open, and the user's edits are kept
