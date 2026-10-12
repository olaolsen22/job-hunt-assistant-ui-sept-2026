# application-tracking Specification

## Purpose

Covers how the UI shows an application's status, which outcomes the user can record from each
status, and undoing the latest status change.

## Requirements

### Requirement: Application statuses

The UI SHALL show a label for every status the API returns: Saved, Applied, Interviewing, Offer,
Accepted, Rejected, Withdrawn. Accepted SHALL look different from Offer.

#### Scenario: Accepted listing

- **WHEN** a listing's status is `ACCEPTED`
- **THEN** its status badge reads "Accepted" on the list card, the detail page, and the timeline, and the page renders without errors

### Requirement: Outcomes per status

The Record outcome action SHALL offer only the outcomes the API allows from the current status.
From Applied or Interviewing: Offer, Rejected, Withdrawn. From Offer: Accepted, Offer withdrawn
(`REJECTED`), Declined (`WITHDRAWN`). From any other status: no action.

#### Scenario: Recording an outcome after applying

- **WHEN** the listing is Applied and the user opens Record outcome
- **THEN** the choices are Offer, Rejected, and Withdrawn

#### Scenario: Resolving an offer

- **WHEN** the listing is at Offer and the user opens Record outcome
- **THEN** the choices are Accepted, Offer withdrawn, and Declined

#### Scenario: Accepting an offer

- **WHEN** the user picks Accepted and saves
- **THEN** the listing's status becomes Accepted and no further outcome action is shown

#### Scenario: Final statuses

- **WHEN** the listing is Accepted, Rejected, or Withdrawn
- **THEN** no Record outcome action is shown

### Requirement: Undo blocked by a reopened duplicate

When undoing a final status would reopen a listing whose URL is already used by another open
listing, the UI SHALL show the API's error message and a link to that open listing. The status
SHALL stay unchanged.

#### Scenario: Undo rejected after reposting

- **WHEN** the user undoes Rejected on listing A and an open listing B has the same URL
- **THEN** the UI shows the error with a link to listing B, and listing A stays Rejected

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

### Requirement: Tailor a CV link when applying

When the listing has no tailored CV draft, the apply form SHALL show a "Tailor a CV first" link to the draft editor.
The link SHALL NOT block applying. When a draft exists, the link SHALL NOT be shown.

#### Scenario: No draft

- **WHEN** the apply form opens for a listing with no draft
- **THEN** a "Tailor a CV first" link to `/listings/[id]/cv` is shown and Apply still works

#### Scenario: Draft exists

- **WHEN** the apply form opens for a listing with a saved draft
- **THEN** no tailoring link is shown
