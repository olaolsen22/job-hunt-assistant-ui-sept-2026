# Spec Delta

## MODIFIED Requirements

### Requirement: Editable CV review

The review SHALL show editable basics, links, hobbies, experience, education, certifications, projects, skills, languages, and bullets with relevant warnings beside their fields or entries. Selected invalid values SHALL prevent the save request until corrected or skipped, while Save remains actionable to guide correction. Missing skill levels SHALL use visible defaults; dates and language proficiency SHALL require review rather than guessed values.

#### Scenario: Incomplete candidate

- **WHEN** a candidate lacks a required start month or language level
- **THEN** the owner can correct or skip the affected item, and clicking Save opens and focuses the first correction with a plain-language inline message

#### Scenario: Current or ongoing entry

- **WHEN** a selected entry has no end month
- **THEN** the review makes the current/ongoing interpretation explicit for confirmation and shows any needed correction at the related control

#### Scenario: Empty candidate

- **WHEN** no supported content is available or all content is skipped
- **THEN** the footer explains that nothing is selected and Save import is disabled with styling clearly distinct from its enabled state, without adding labels as a substitute for that distinction

### Requirement: Atomic reviewed CV save

Save import SHALL send one valid reviewed selection, disable duplicate submissions, and update the profile only on success. Invalid attempts SHALL give actionable feedback without sending a mutation. Failed saves SHALL keep edits and show readable errors at affected fields or beside Save. Import SHALL preserve Norwegian translations and omitted content; changed translated sources can become stale. Import SHALL NOT delete or reorder bullets.

#### Scenario: Successful save

- **WHEN** the atomic import succeeds
- **THEN** the returned profile is shown and the modal closes with success feedback

#### Scenario: Rejected save

- **WHEN** validation rejects any selected item
- **THEN** no partial profile changes are displayed, edits remain available, and recognized field errors appear inline with focus moved to the first correction

#### Scenario: Unknown target ID

- **WHEN** an update target no longer exists
- **THEN** the error asks the owner to choose the saved entry or bullet again, existing target options are refreshed, and reviewed edits are preserved for reselection

#### Scenario: Close unsaved review

- **WHEN** the owner dismisses a populated review
- **THEN** discarding it requires confirmation; dismissal and repeated submission are disabled while saving or parsing

#### Scenario: Invalid Save attempt

- **WHEN** the owner clicks Save import while selected fields need correction
- **THEN** the footer announces a short correction count, the first affected entry opens, its invalid control receives focus, and no import mutation runs

#### Scenario: Request-wide failure

- **WHEN** saving fails without a recognizable field location
- **THEN** readable feedback appears beside Save with useful backend details available on demand, and the owner retains all edits

#### Scenario: Disabled styling is recognizable

- **WHEN** Save import is unavailable because the request is busy or nothing is selected
- **THEN** its background, border and foreground visibly differ from the enabled treatment in light and dark modes, and enabled hover/active styling does not appear

## ADDED Requirements

### Requirement: CV skill level defaults

Missing imported standalone skill levels SHALL default to 1 for new names and retain the saved level for existing names. Valid supplied levels SHALL be retained. Defaults SHALL be visible and editable without requiring a separate confirmation. Save SHALL use the displayed reviewed level; 0 SHALL NOT be used as a default.

#### Scenario: Missing new-skill level

- **WHEN** a new imported skill has no level
- **THEN** its control shows level 1, a short note explains the default, and its missing-level warning does not block saving

#### Scenario: Missing existing-skill level

- **WHEN** an imported skill name already has saved level 4 and the CV supplies no level
- **THEN** the review displays and retains level 4 rather than lowering it

#### Scenario: Supplied or edited skill level

- **WHEN** the CV supplies a valid level or the owner changes the displayed level
- **THEN** that level is used on save; an invalid supplied level receives inline correction feedback

### Requirement: Local and readable CV review feedback

Review feedback SHALL use field labels and entry names, without raw JSON paths in primary messages. Each issue SHALL appear once beside the affected field or entry. Resolved and skipped issues SHALL disappear from actionable feedback. Source notes that cannot be tied to a current correction SHALL remain in a collapsed Import notes area. The footer SHALL give a short status rather than a detailed error list.

#### Scenario: Missing month on an experience

- **WHEN** an experience has an incomplete start date
- **THEN** its Start month control shows “Choose a start month and year,” with no `experiences[0].startMonth` prefix

#### Scenario: Correct or skip an issue

- **WHEN** the owner fixes a value or skips its item
- **THEN** its correction message and needs-attention state disappear without leaving a duplicate original warning

#### Scenario: Server selection path differs from draft position

- **WHEN** a save error refers to a selected row after earlier draft rows were skipped
- **THEN** its inline feedback appears on the actual selected row and field, without displaying the path as a user label

### Requirement: Compact CV history review

History entries SHALL have compact summaries with their readable title, Add new/Update existing/Skip choice, and current needs-attention state. Complete entries SHALL initially be collapsed and remain editable when expanded. Save correction navigation SHALL open all ancestors of the targeted field and bring it into view within the modal.

#### Scenario: Long CV review

- **WHEN** a CV contains many complete history entries
- **THEN** the owner sees scan-friendly summaries and can expand an entry to review all its fields

#### Scenario: Hidden invalid field

- **WHEN** the first invalid selected field is inside a collapsed entry
- **THEN** clicking Save expands it, scrolls it into view, and focuses its control for keyboard correction
