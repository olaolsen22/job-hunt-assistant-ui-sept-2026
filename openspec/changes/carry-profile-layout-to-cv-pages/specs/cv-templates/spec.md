# Spec Delta

## ADDED Requirements

### Requirement: Editor section cards

The template editor's content sections SHALL behave as the tailored CV editor's do. An empty section SHALL show one
compact row with an icon and its message. Experience, Skills, Education, Certifications, Projects and Languages SHALL
show their item count after the title. Below tablet width (768 px) sections SHALL be collapsible from their header:
Contact and headline, Summary and Experience start open and the rest start collapsed. A section that holds a pending
AI draft suggestion or a part still in the language it was translated from SHALL be open and SHALL NOT be
collapsible while that holds. From tablet width up no section SHALL be collapsible. This applies to the create page
and the template page alike.

#### Scenario: Empty new template from the profile

- **WHEN** the owner starts a template from an empty profile
- **THEN** each section shows a single-row empty message instead of a tall block

#### Scenario: Phone

- **WHEN** the owner opens a template at 375 px
- **THEN** Contact and headline, Summary and Experience are open and the other sections are collapsed with their
  counts

#### Scenario: Flagged translation on a phone

- **WHEN** a translated language leaves Skills flagged as still in the source language
- **THEN** Skills is open with its warning and cannot be collapsed until the flag is cleared, so Next reaches it

## MODIFIED Requirements

### Requirement: Template editor

`/cv-templates/[id]` SHALL show:

- the template's name and description
- Versions and Preview PDF
- a menu with Edit details (name and description), Archive or Restore, and Delete

Below 640 px (`sm`) Preview PDF SHALL stay a labelled button and Versions SHALL be an item in the menu instead of a
button, disabled when the language has no saved version.

Each language SHALL be a tab. Saving changed content SHALL create that language's next version, with an optional
note, and unchanged content SHALL keep the latest version. CV style, entry format and PDF layout SHALL be set only in
the editor's Layout card. Edits SHALL change the template only, never the profile. Replace with my profile SHALL load
the profile as an unsaved change, and SHALL ask first when there are unsaved edits. Delete of a template whose version
was already sent SHALL offer Archive instead.

#### Scenario: Save a version

- **WHEN** the owner edits the English content and saves
- **THEN** a new English version is created, and the tab shows its number

#### Scenario: Versions on a phone

- **WHEN** the owner opens the menu on a template at 375 px
- **THEN** it lists Versions above Edit details, and choosing it opens the versions panel
