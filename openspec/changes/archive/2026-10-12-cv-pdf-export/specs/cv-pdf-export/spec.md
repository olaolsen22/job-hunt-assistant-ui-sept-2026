# Spec Delta

## Purpose

Lets the owner generate a PDF CV from a saved tailored draft and find it among the listing's documents.

## ADDED Requirements

### Requirement: Generate from a saved draft

The tailored CV editor SHALL offer Generate PDF once a draft is persisted, including when reopening it. The action SHALL be disabled while edits are unsaved, saving, AI work, or generation is in progress, and unsaved edits SHALL show save-first guidance. Generation SHALL never start automatically.

#### Scenario: Saved draft

- **WHEN** the draft is saved and has no unsaved edits
- **THEN** Generate PDF is enabled

#### Scenario: Unsaved edits

- **WHEN** the owner edits a saved draft
- **THEN** Generate PDF is disabled and the editor asks them to save first

#### Scenario: Generation in progress

- **WHEN** the owner activates Generate PDF
- **THEN** progress is shown and a second request cannot start until the first finishes

### Requirement: Result and document refresh

On success the UI SHALL confirm the new document, link to it with Open PDF, and refresh the listing's documents. Each generation SHALL produce a separate unsent document; earlier documents SHALL stay. If the refresh fails, the Open PDF link SHALL remain and a refresh-only retry SHALL be offered.

#### Scenario: Generated twice

- **WHEN** the owner generates two times
- **THEN** two distinct documents are linked and neither replaces the other

#### Scenario: Generated CV is selectable

- **WHEN** generation succeeds and documents refresh
- **THEN** the new CV appears as an unsent document that can be selected when marking the listing applied

### Requirement: Typed error recovery

The UI SHALL show the API's message inline for generation errors without creating retries automatically.

#### Scenario: Draft missing

- **WHEN** the API returns `TailoredCvDraftNotFoundError`
- **THEN** the owner is told to save the draft first, edits are kept, and Save draft can recreate it

#### Scenario: Listing unavailable

- **WHEN** the API returns `ListingNotFoundError`
- **THEN** an unavailable message with a way back to the listings is shown
