# Spec Delta

## Purpose

Covers how the UI shows an application's status, which outcomes the user can record from each
status, and undoing the latest status change.

## ADDED Requirements

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
