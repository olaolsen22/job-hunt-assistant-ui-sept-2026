# Spec Delta

## Purpose

Lets the owner generate application-ready PDF documents from reviewed, saved tailored CV drafts and access each preserved version securely.

## ADDED Requirements

### Requirement: Generate from a saved draft

The tailored CV editor SHALL offer Generate PDF after a persisted draft exists, including when reopening it. Generation SHALL use the saved draft. The action SHALL be disabled while edits are unsaved, saving or AI processing runs, or generation runs. Unsaved edits SHALL show save-first guidance. Generation SHALL never run automatically after save.

#### Scenario: First draft saved

- **WHEN** the owner successfully saves a reviewed draft
- **THEN** Generate PDF becomes available beside Save draft

#### Scenario: Saved draft has new edits

- **WHEN** the owner edits a saved draft
- **THEN** Generate PDF is disabled and the editor prompts them to save changes first

#### Scenario: Generation in progress

- **WHEN** the owner activates Generate PDF
- **THEN** the action shows Generating PDF progress and prevents another generation until the request completes

### Requirement: Successful generation and document refresh

On successful generation, the UI SHALL confirm creation, offer Open PDF for the returned document, and refresh the listing's documents. If that refresh fails, the UI SHALL retain the generated document link and offer a refresh retry without generating again.

#### Scenario: Documents refreshed

- **WHEN** generation succeeds and the listing refresh completes
- **THEN** the new document appears in the listing documents and is available as an unsent CV in the apply form

#### Scenario: Refresh fails after creation

- **WHEN** a PDF is created but the listing refresh fails
- **THEN** the UI confirms creation, keeps Open PDF available, explains the refresh failure, and offers a retry that only refreshes the listing

### Requirement: Authenticated PDF access

The UI SHALL open generated PDFs through authenticated same-origin GET `/api/documents/{id}`. The PDF SHALL be previewable and downloadable through the browser's PDF controls. The UI SHALL keep the existing document links for older versions.

#### Scenario: Open generated PDF

- **WHEN** the owner selects Open PDF after generation
- **THEN** a new tab opens the authenticated document endpoint for the returned id, with browser preview and download available

### Requirement: Repeated generation preserves versions

Each explicit successful generation SHALL create a new unsent CV document, preserve all older documents, and leave application status and sent documents unchanged. The generation UI SHALL explain that each generation adds a new PDF and keeps previous versions.

#### Scenario: Generate twice

- **WHEN** the owner successfully generates a PDF twice
- **THEN** both new CV documents remain available, both are unsent, and previously existing documents remain unchanged

### Requirement: Generation errors and recovery

The UI SHALL prompt the owner to save a draft first for `TailoredCvDraftNotFoundError`, show that the listing is unavailable for `ListingNotFoundError`, and show other API messages or the existing generic transport error. Failure SHALL retain draft edits and restore the action's loading state. A request whose outcome is unknown SHALL NOT be automatically retried.

#### Scenario: Draft no longer exists

- **WHEN** generation returns `TailoredCvDraftNotFoundError`
- **THEN** the UI prompts the owner to save a draft first and provides a usable save recovery path

#### Scenario: Listing unavailable

- **WHEN** generation returns `ListingNotFoundError`
- **THEN** the UI says the listing is unavailable and offers Back to listings

#### Scenario: Transport failure

- **WHEN** the generation request fails without a successful response
- **THEN** the UI shows an error, stops showing progress, preserves edits, and sends no automatic retry
