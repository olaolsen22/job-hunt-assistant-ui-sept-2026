# listing-creation Specification

## Purpose

Covers adding listings through the full form, quick-add, and parsed drafts from an ad, including
the warnings about duplicates and earlier attempts at the same posting.

## Requirements

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

### Requirement: Saved edits show on the listing page

After a listing edit is saved, the listing page SHALL show the saved values without a manual page refresh.

#### Scenario: Save after analyzing from an ad

- **WHEN** the owner opens a listing, edits it (including via "Paste from ad"), and saves successfully
- **THEN** the listing page opens showing the saved title, fields, and requirements, not the values from before the edit

#### Scenario: Save fails

- **WHEN** the API returns errors for the save
- **THEN** the owner stays on the edit page and the errors are shown, as before

### Requirement: Saved forms leave no history entry

After a successful save, the add and edit listing forms SHALL be replaced in browser history by the
page they navigate to, so Back does not return to a form that was already submitted.

#### Scenario: Back after saving an edit

- **WHEN** the user opens a listing from a filtered list, edits it, saves, and presses browser Back on the details page
- **THEN** the filtered list is shown, not the edit form

#### Scenario: Back after adding a listing

- **WHEN** the user adds a listing and is redirected to `/listings`, then presses browser Back
- **THEN** the page before the add form is shown, not the add form

### Requirement: Listing form contacts

The listing form (add and edit) SHALL have a Contacts section with one row per linked contact
(name, title, email, phone, link) and the ability to add and remove rows. On edit it SHALL start with
the listing's linked contacts. On save the UI SHALL send the rows with a non-empty name (trimmed,
blank fields as null); removing every row SHALL unlink all contacts. A returned
`InvalidListingError` SHALL be shown as with other save errors.

#### Scenario: Removing a contact on edit

- **WHEN** the user removes a linked contact's row and saves
- **THEN** the save sends the remaining contacts and the listing page no longer shows the removed one

### Requirement: Parsed drafts carry contacts

When a full parsed draft (AI parser, pasted JSON, or URL parse) contains contacts, the UI SHALL keep
those with a non-empty name (duplicate names dropped case-insensitively). On a new listing they fill
the Contacts section; on an existing listing they SHALL be added to the current rows, skipping names
already there (case-insensitive).

#### Scenario: New listing from a parsed ad with a recruiter

- **WHEN** a parsed draft with `contacts: [{ name: "Kari", email: "kari@x.no" }]` fills the add form
- **THEN** the Contacts section shows Kari and saving sends that contact

#### Scenario: Re-analyzing an existing listing

- **WHEN** an existing listing linked to "Kari" is re-parsed with contacts "KARI" and "Ola"
- **THEN** the Contacts section shows Kari and Ola

### Requirement: Parse a new listing from its link

On the add listing page, the Analyze ad modal SHALL offer a "From link" option with its own link
input, prefilled from the form's Ad link, that parses the ad at that link. Parsing SHALL use a full
parse and SHALL NOT save anything. The parsed values SHALL fill the form the same way a pasted ad
does, and the typed URL SHALL be kept and sent when the listing is saved. Saved listings SHALL keep
parsing from their stored link as before.

#### Scenario: Opens on From link

- **WHEN** the owner opens Analyze ad on the add page
- **THEN** the From link tab is selected

#### Scenario: Needs a link

- **WHEN** the form's Ad link field is empty
- **THEN** "Parse from link" is disabled

#### Scenario: Successful parse fills the form

- **WHEN** the owner parses from the link and the API returns a finished parse
- **THEN** the modal closes, the form is filled from the result and its Ad link holds the parsed link

#### Scenario: Page cannot be read

- **WHEN** the API returns an error for the URL (invalid link, blocked site, or an ad built by JavaScript)
- **THEN** the error shows in the From link tab with a "Paste the ad instead" option, the modal stays open, and the form is unchanged

#### Scenario: Paste fallback keeps the link

- **WHEN** the owner pastes the ad instead and parses it
- **THEN** the form is filled and its Ad link holds the link typed in the modal
