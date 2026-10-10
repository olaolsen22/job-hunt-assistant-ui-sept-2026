# Spec Delta

## ADDED Requirements

### Requirement: Compare a quick-add row with a possible duplicate

When a saved quick-add row has possible duplicates, each match SHALL offer a Compare action that
opens a modal showing the new listing and that match field by field (title, company, role, URL,
locations, posted date, deadline, existing status). Fields whose values differ SHALL be visually
marked. The modal SHALL offer Open existing, Keep both, and Remove new one.

#### Scenario: Compare one match

- **WHEN** a saved row has one possible duplicate and the user clicks its Compare button
- **THEN** a modal shows the new listing's values as "New" and the match's values as "Existing" for each field, with differing fields marked

#### Scenario: Switch between several matches

- **WHEN** a saved row has two possible duplicates and the user opens Compare on the first
- **THEN** the modal shows a "Compare with" selector, and choosing the second match replaces the Existing values without closing the modal

#### Scenario: Single match has no selector

- **WHEN** the row has exactly one possible duplicate
- **THEN** the modal shows no "Compare with" selector

#### Scenario: Keep both from the modal

- **WHEN** the user clicks Keep both in the modal
- **THEN** the modal closes and the row's possible-duplicate note is dismissed, as with the note's own Keep both

#### Scenario: Remove the new one from the modal

- **WHEN** the user clicks Remove new one in the modal
- **THEN** the modal closes and the existing remove confirmation opens for that row's new listing

#### Scenario: Narrow screen

- **WHEN** the modal is open on a phone-width screen
- **THEN** each field shows its label with the New and Existing values stacked beneath it, each tagged, rather than in two columns
