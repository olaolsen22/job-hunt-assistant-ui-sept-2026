# Spec Delta

## Purpose

Lets the user fill an existing listing's form from the ad at its saved URL without pasting the ad text,
keeping the paste flow as the fallback for sites that can't be read.

## ADDED Requirements

### Requirement: Parse automatically for a saved listing

The parse modal SHALL offer a "Parse automatically" action only when it is opened for a saved listing. It SHALL ask
the API to fetch and parse the listing's saved URL, show a loading state until the API answers, and use no short
client-side timeout.

#### Scenario: Successful parse

- **WHEN** the user clicks "Parse automatically" on the edit page and the job succeeds
- **THEN** the modal closes, the form is filled exactly as after a pasted-ad parse (parsed values win, saved ones kept where the parse is empty), and nothing is saved until the user saves

#### Scenario: Waiting

- **WHEN** the request is in flight
- **THEN** the button shows loading and cannot be clicked again

#### Scenario: Add page

- **WHEN** the modal is opened on the add page
- **THEN** there is no "Parse automatically" action, only the paste options

### Requirement: Failures keep the paste flow available

When the automatic parse fails, the modal SHALL stay open, show the reason, and keep the paste options usable.

#### Scenario: Failed job or unreadable page

- **WHEN** the job comes back `FAILED`, or the API returns `InvalidParseRequestError` or `ListingNotFoundError`
- **THEN** the modal shows the message and the user can retry or paste the ad
