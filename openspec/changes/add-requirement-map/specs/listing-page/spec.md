# Spec Delta

## ADDED Requirements

### Requirement: Requirements card

The listing page SHALL show one "Requirements" card. A null map SHALL show an empty state linking to
`/listings/[id]/requirements`. A saved map SHALL show evidenced/partial/gap counts, list gaps and partial needs with
required before preferred and gaps before partial within each importance, and offer Edit. Loading and error states
SHALL be distinct from an empty map.

#### Scenario: No map yet

- **WHEN** the listing has no saved requirement map
- **THEN** the card shows the empty state and "Map requirements" links to `/listings/[id]/requirements`

#### Scenario: Saved map

- **WHEN** the listing has a map with 5 evidenced needs, 1 partial need and 2 gaps
- **THEN** the card shows those three counts and lists the 3 gap and partial needs, required before preferred and
  gaps before partial

#### Scenario: Everything evidenced

- **WHEN** every need in the saved map is evidenced
- **THEN** the card shows the counts and says there are no gaps

#### Scenario: Load fails

- **WHEN** the map cannot be loaded
- **THEN** the card shows an error with Retry

### Requirement: Requirements card placement

For Saved listings the card SHALL follow Summary and precede Tailored CV. For other statuses it SHALL follow
Application and precede Tailored CV in the upper workflow block. This reading order SHALL hold on phone, tablet,
and desktop, without duplicating the card or moving the application-first workflow.

#### Scenario: Saved listing order

- **WHEN** a Saved listing is opened at any supported width
- **THEN** Summary, Requirements and Tailored CV appear in that order, with one Requirements card

#### Scenario: Active application order

- **WHEN** a listing whose status is not Saved is opened at any supported width
- **THEN** Application, Requirements and Tailored CV appear in that order, with one Requirements card

### Requirement: Saved map isolation

The card SHALL show only persisted map content. Unsaved generation, preview, or editor changes SHALL NOT alter it.
After a successful save or delete, returning to the listing SHALL show the latest persisted state.

#### Scenario: Candidate discarded

- **WHEN** the user loads a candidate and discards it without saving
- **THEN** the listing card still shows the previous saved map or its original empty state

#### Scenario: Full replacement

- **WHEN** the user replaces a saved map and returns to the listing
- **THEN** counts and review needs reflect only the returned saved content, including removed needs
