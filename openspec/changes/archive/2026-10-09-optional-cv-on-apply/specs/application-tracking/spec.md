## ADDED Requirements

### Requirement: Applying without documents

The apply form SHALL NOT require a CV or cover letter. Only the applied date is required. When no
CV is chosen, the UI SHALL send no CV id, and the listing moves to Applied with the date and note.
The CV field SHALL show help text suggesting the note says how the user applied. API errors SHALL
be shown as returned.

#### Scenario: Apply via a form with no CV

- **WHEN** the user opens Apply on a Saved listing, picks no documents, writes "Applied via form" in the note, and confirms
- **THEN** the request has no CV or cover letter id, and the listing becomes Applied

#### Scenario: Apply with a CV

- **WHEN** the user picks an existing CV and confirms
- **THEN** the request carries that CV's id, as before

#### Scenario: Applied listing with no sent documents

- **WHEN** an Applied listing has no documents, or none with a sent date
- **THEN** the listing page renders without errors and shows no "Sent" badge
