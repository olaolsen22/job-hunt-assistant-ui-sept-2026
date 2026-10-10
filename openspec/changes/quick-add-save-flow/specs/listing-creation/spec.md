# Spec Delta

## ADDED Requirements

### Requirement: Quick-add saves only on the Save button

Quick-add rows SHALL be saved only when the user clicks the "Save N listings" button. Pressing Enter in
a row field SHALL NOT save anything. Saving SHALL still validate the pending rows first.

#### Scenario: Enter in a row field

- **WHEN** the user presses Enter in a pending row's Job title field
- **THEN** no listing is saved and the rows stay editable

#### Scenario: Save button

- **WHEN** the user clicks "Save 2 listings" with two valid rows
- **THEN** both rows are saved

### Requirement: Leaving quick-add

The page SHALL offer one leave action labeled by destination, never Done or Cancel. While rows are
pending it SHALL read "Back to listings"; if at least one row was saved and rows are still pending,
it SHALL ask for confirmation before leaving. When nothing is pending and something was saved, Save
SHALL be hidden and the leave action SHALL be the primary "View listings" button.

#### Scenario: Nothing saved yet

- **WHEN** rows are pending and none were saved, and the user clicks "Back to listings"
- **THEN** the user goes to `/listings` without a confirmation

#### Scenario: Unsaved rows after a partial save

- **WHEN** one row was saved and one row failed, and the user clicks "Back to listings"
- **THEN** a confirmation "Leave 1 unsaved listing?" says saved listings are kept, and confirming goes to `/listings`

#### Scenario: Everything saved

- **WHEN** every row has been saved
- **THEN** the Save button is hidden and a primary "View listings" button goes to `/listings`

### Requirement: Quick-add save status

After the first save, the action bar SHALL show how many rows are saved and how many still need
fixing, and the top summary SHALL no longer tell the user to save when nothing is pending.

#### Scenario: Partial save

- **WHEN** a save leaves 3 rows saved and 1 row with an error
- **THEN** the action bar shows "3 saved · 1 needs fixing"

#### Scenario: All saved

- **WHEN** all pasted rows are saved
- **THEN** the top summary says they are all saved instead of "Check them below, then save"
