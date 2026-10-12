# Spec Delta

## ADDED Requirements

### Requirement: Preselected CV when applying

The apply form SHALL accept a CV document to preselect when it opens from the tailored CV flow. The owner SHALL still
be able to change or clear it. Opened from the application card, the form SHALL start with no CV selected, as before.

#### Scenario: Opened with a PDF

- **WHEN** the apply form opens from Apply with this CV
- **THEN** that PDF is selected as the CV, and confirming sends its id

#### Scenario: Opened from the application card

- **WHEN** the owner opens Apply from the application card
- **THEN** no CV is selected
