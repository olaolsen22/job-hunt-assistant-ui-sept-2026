# Spec Delta

## Purpose

Covers adding listings through the full form, quick-add, and parsed drafts from an ad, including
the warnings about duplicates and earlier attempts at the same posting.

## ADDED Requirements

### Requirement: Parsed drafts use current deadline types

When a parsed draft (from the AI parser or a pasted external AI reply) has the deadline type
`ROLLING`, the UI SHALL fill the form with ASAP. Unknown deadline types SHALL fall back to Not stated.

#### Scenario: Old parse result says ROLLING

- **WHEN** a draft with `deadlineType: "ROLLING"` fills the form or a quick-add row
- **THEN** the Deadline field is set to ASAP

### Requirement: Previous attempts

After a listing is saved, if the API reports earlier closed listings with the same URL
(`previousAttempts`), the UI SHALL tell the user and link to the most recent one. The new listing
SHALL still count as saved.

#### Scenario: Re-adding a reposted ad on the full form

- **WHEN** the user saves a listing on `/listings/add` whose URL matches an earlier Rejected listing
- **THEN** the "Listing added" confirmation also says the user applied to this posting before, with a link to the earlier listing

#### Scenario: Re-adding in quick-add

- **WHEN** a quick-add row is saved and the API returns previous attempts for it
- **THEN** that row shows a note listing each previous attempt (title and status) with links, separate from the possible-duplicates note

### Requirement: Duplicate URL among open listings

When the URL already belongs to an open listing, saving SHALL fail for that listing with the API's
message and a link to the existing listing.

#### Scenario: Same URL still open

- **WHEN** a quick-add row's URL matches an open listing
- **THEN** that row shows the error and "View the existing listing" links to it
