## ADDED Requirements

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
