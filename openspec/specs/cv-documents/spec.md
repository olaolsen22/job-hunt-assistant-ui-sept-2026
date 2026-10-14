# cv-documents Specification

## Purpose

Lets the owner generate application-ready PDF documents from reviewed, saved tailored CV drafts and access each preserved version securely.

## Requirements

### Requirement: Generate from a saved draft

The tailored CV editor SHALL always offer Generate PDF as its primary action until a current PDF exists. With unsaved
edits, or no saved draft, Generate PDF SHALL save the draft first and generate only when the save succeeds. The
action SHALL be disabled only while AI processing, saving or generation runs. While suggestions are pending, a
non-blocking notice beside the action SHALL say how many are not reviewed. Saving alone SHALL never generate.

#### Scenario: First draft saved

- **WHEN** the listing has no saved draft and the owner clicks Generate PDF
- **THEN** the candidate is saved as the draft first, then a PDF is generated from it

#### Scenario: Saved draft has new edits

- **WHEN** the owner edits a saved draft and clicks Generate PDF
- **THEN** the draft is saved, then a PDF is generated from it, with one progress state for both

#### Scenario: Save fails during generate

- **WHEN** the save step returns an error
- **THEN** the save error is shown, edits are kept, and no generation request is sent

#### Scenario: Pending suggestions

- **WHEN** two suggestions are pending
- **THEN** Generate PDF stays enabled and a notice says "2 suggestions not reviewed"

#### Scenario: Generation in progress

- **WHEN** the owner activates Generate PDF
- **THEN** the action shows progress and prevents another generation until the request completes

### Requirement: Successful generation and document refresh

On successful generation, the UI SHALL open the PDF preview for the returned document and refresh the listing's
documents. If that refresh fails, the preview SHALL still work, and the editor SHALL explain the refresh failure and
offer a retry that only refreshes the listing.

#### Scenario: Documents refreshed

- **WHEN** generation succeeds and the listing refresh completes
- **THEN** the preview opens, and the new document is the latest PDF and available as an unsent CV in the apply form

#### Scenario: Refresh fails after creation

- **WHEN** a PDF is created but the listing refresh fails
- **THEN** the preview still opens, the editor explains the refresh failure, and its retry only refreshes the listing

### Requirement: Authenticated PDF access

The UI SHALL open generated PDFs through authenticated same-origin GET `/api/documents/{id}`. The PDF SHALL be previewable and downloadable through the browser's PDF controls. The UI SHALL keep the existing document links for older versions.

#### Scenario: Open generated PDF

- **WHEN** the owner selects Open PDF after generation
- **THEN** a new tab opens the authenticated document endpoint for the returned id, with browser preview and download available

### Requirement: In-app PDF preview

The preview SHALL open as a dialog on the editor, fullscreen on phones, showing the document through the
authenticated endpoint and titled with its file name, with Open PDF inside. For a Saved listing it SHALL offer Apply
with this CV. If the preview hasn't loaded after 10 seconds, it SHALL show a prominent Open PDF; after 30 seconds a
notice offering Open PDF SHALL replace the loading state. Closing SHALL keep the editor's state intact.
Downloading SHALL only happen through a Download action; a browser without a built-in PDF viewer SHALL get a notice
instead of the inline preview.

#### Scenario: Preview generated PDF

- **WHEN** generation succeeds
- **THEN** the preview dialog opens on its own with the new document, and Close returns to the editor unchanged

#### Scenario: Apply from the preview

- **WHEN** the listing is Saved and the owner clicks Apply with this CV in the preview
- **THEN** the preview closes and the apply form opens with that PDF selected as the CV

#### Scenario: No automatic download

- **WHEN** the preview opens in a browser without a built-in PDF viewer
- **THEN** no file is downloaded, a notice offers Download and Open PDF, and Download saves the file only when clicked

#### Scenario: Preview is slow or blocked

- **WHEN** the PDF has not loaded after 10 seconds
- **THEN** the dialog shows an Open PDF fallback, and after 30 seconds the loading state is replaced with a notice
  offering Open PDF

### Requirement: Repeated generation preserves versions

Each successful generation SHALL create a new unsent CV document, preserve all older documents, and leave application
status and sent documents unchanged. When the latest PDF is current, the editor SHALL offer Preview PDF instead of
Generate PDF, so an unchanged draft creates no new PDF.

#### Scenario: Generate twice

- **WHEN** a current PDF exists and the owner edits the draft and clicks Generate PDF
- **THEN** a second CV document is created, both are unsent, and earlier documents are unchanged

#### Scenario: Unchanged draft

- **WHEN** the latest PDF is current
- **THEN** the editor offers Preview PDF and no Generate PDF action

### Requirement: Generation errors and recovery

For `TailoredCvDraftNotFoundError` the UI SHALL say the saved draft was missing and treat the candidate as unsaved,
so the next Generate PDF saves it again. It SHALL show that the listing is unavailable for `ListingNotFoundError`,
and show other API messages or the generic transport error. Failure SHALL keep edits and end the progress state. A
request whose outcome is unknown SHALL NOT be retried automatically.

#### Scenario: Draft no longer exists

- **WHEN** generation returns `TailoredCvDraftNotFoundError`
- **THEN** the UI says the draft was missing, the candidate shows unsaved changes, and Generate PDF saves it again

#### Scenario: Listing unavailable

- **WHEN** generation returns `ListingNotFoundError`
- **THEN** the UI says the listing is unavailable and offers Back to listings

#### Scenario: Transport failure

- **WHEN** the generation request fails without a successful response
- **THEN** the UI shows an error, stops showing progress, preserves edits, and sends no automatic retry

### Requirement: Latest PDF

The latest PDF SHALL be the listing's newest unsent CV document. It SHALL be current when it is newer than the saved
draft and there are no unsaved edits. The editor SHALL show the latest PDF's file name and creation time with
Preview, and say when it is older than the draft. It SHALL survive a reload. The UI cannot tell generated PDFs from
uploaded CVs.

#### Scenario: Reload after generating

- **WHEN** the owner reloads the editor after generating a PDF
- **THEN** the latest PDF is shown as current, with Preview

#### Scenario: Draft changed after the PDF

- **WHEN** the draft was saved after the latest PDF was created
- **THEN** the editor marks the PDF as older than the draft and Generate PDF is the primary action

### Requirement: Apply handoff from the editor

When a current PDF exists and the listing is Saved, the sticky bar's primary action SHALL be Apply with this CV,
beside Preview PDF. It SHALL open the apply form on the editor with that PDF selected. After a successful apply, the
editor SHALL return to the listing page.

#### Scenario: Apply from the bar

- **WHEN** a current PDF exists on a Saved listing and the owner clicks Apply with this CV
- **THEN** the apply form opens on the editor with the PDF selected, and confirming it opens the listing page showing
  it Applied

#### Scenario: Listing already applied

- **WHEN** the listing is not Saved
- **THEN** no Apply with this CV action is shown
