# Spec Delta

## ADDED Requirements

### Requirement: English CV import entry point

The profile page SHALL offer Import CV for empty and populated English-primary profiles. The modal SHALL use the listing parsing modal's paste and external AI pattern, with no built-in upload or URL input. Norwegian-primary profiles SHALL show why import is unavailable and SHALL NOT switch language automatically.

#### Scenario: Existing English profile

- **WHEN** the owner opens Import CV on an English-primary profile with Norwegian translations
- **THEN** the import modal opens and translations do not block import

#### Scenario: Norwegian-primary profile

- **WHEN** the profile's content language is Norwegian
- **THEN** import is unavailable with an explanation pointing to the existing content-language control

### Requirement: Built-in CV parsing

The modal SHALL accept English text or Markdown and parse it without saving profile content. It SHALL show the paid AI notice and usage information following the existing parsing modal pattern. Failed parsing SHALL keep the input and show the API error with retry and external AI available.

#### Scenario: Successful parse

- **WHEN** the owner parses accepted CV text and parsing succeeds
- **THEN** the returned candidate opens in the editable review and no import save is sent

#### Scenario: Parse fails

- **WHEN** parsing returns a failed result, typed error, or transport failure
- **THEN** the modal stays open, shows the error, and preserves the CV text

### Requirement: External CV parsing

The modal SHALL let the owner copy the backend CV prompt, use it with their CV externally, and paste JSON for server validation. Prompt copy SHALL NOT require CV text in the app. Both parsing routes SHALL share the same candidate review.

#### Scenario: External prompt and JSON

- **WHEN** the owner copies the prompt and submits valid external JSON
- **THEN** the server-validated candidate opens for review without saving profile content

#### Scenario: Invalid JSON candidate

- **WHEN** the preview API rejects the JSON
- **THEN** the modal shows its message and preserves the JSON for correction

### Requirement: Editable CV review

The review SHALL show editable basics, links, hobbies, experience, education, certifications, projects, skills, languages, and bullets with warnings associated with their paths. Selected invalid values SHALL block save until corrected or skipped. Missing dates or proficiency SHALL require review rather than guessed values.

#### Scenario: Incomplete candidate

- **WHEN** a candidate lacks a required start month or skill/language level
- **THEN** its warning is visible and the owner can correct or skip it before saving

#### Scenario: Current or ongoing entry

- **WHEN** a selected entry has no end month
- **THEN** the review makes the current/ongoing interpretation explicit for confirmation

#### Scenario: Empty candidate

- **WHEN** no supported content is available or all content is skipped
- **THEN** the review shows that nothing is selected and Save import is disabled

### Requirement: Explicit CV import selections

History entries and bullets SHALL offer add/update/skip with manual selection of same-kind existing entries and same-parent bullets for updates. No automatic matching SHALL occur. Basics SHALL allow per-field inclusion and explicit clearing; links and hobbies SHALL require explicit inclusion as replacement lists. Skills and languages SHALL show their upsert behavior and allow skipping.

#### Scenario: Add or update an entry

- **WHEN** the owner chooses Add
- **THEN** no entry ID is sent, even if similar content exists
- **WHEN** the owner chooses Update and selects an existing entry
- **THEN** that entry's ID and complete reviewed structural fields are sent, with retained values visible before save

#### Scenario: Bullet update scope

- **WHEN** the owner updates an existing bullet
- **THEN** only a bullet belonging to the chosen parent can be selected, its ID is sent, and unselected bullets remain unchanged

#### Scenario: Preserve omitted content

- **WHEN** the owner skips entries, bullets, basic fields, links, or hobbies
- **THEN** those selections are omitted and the saved content remains unchanged

#### Scenario: Replace a list or clear a field

- **WHEN** the owner explicitly includes links or hobbies, or clears an included optional basic field
- **THEN** the review explains replacement and sends the reviewed list (including an empty list to clear) or explicit null respectively

### Requirement: Atomic reviewed CV save

Save import SHALL send one reviewed selection, disable duplicate submissions, and update the profile only on success. Failed saves SHALL keep the review and show API errors, including selection paths. Import SHALL preserve Norwegian translations and omitted content; changed translated sources can become stale. Import SHALL NOT delete or reorder bullets.

#### Scenario: Successful save

- **WHEN** the atomic import succeeds
- **THEN** the returned profile is shown and the modal closes with success feedback

#### Scenario: Rejected save

- **WHEN** validation rejects any selected item
- **THEN** no partial profile changes are displayed and the review remains available for correction

#### Scenario: Unknown target ID

- **WHEN** an update target no longer exists
- **THEN** its API error is shown, existing target options are refreshed, and reviewed edits are preserved for reselection

#### Scenario: Close unsaved review

- **WHEN** the owner dismisses a populated review
- **THEN** discarding it requires confirmation; dismissal and repeated submission are disabled while saving or parsing
