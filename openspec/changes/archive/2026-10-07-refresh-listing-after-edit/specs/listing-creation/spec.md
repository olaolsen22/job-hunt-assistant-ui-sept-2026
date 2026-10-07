## ADDED Requirements

### Requirement: Saved edits show on the listing page

After a listing edit is saved, the listing page SHALL show the saved values without a manual page refresh.

#### Scenario: Save after analyzing from an ad

- **WHEN** the owner opens a listing, edits it (including via "Paste from ad"), and saves successfully
- **THEN** the listing page opens showing the saved title, fields, and requirements, not the values from before the edit

#### Scenario: Save fails

- **WHEN** the API returns errors for the save
- **THEN** the owner stays on the edit page and the errors are shown, as before
