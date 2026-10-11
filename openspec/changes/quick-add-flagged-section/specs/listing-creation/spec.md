# Spec Delta

## MODIFIED Requirements

### Requirement: Compare a quick-add row with a possible duplicate

When a saved quick-add row has possible duplicates, its possible-duplicate note SHALL show one Compare
button as its primary action, placed before Keep both and Remove new one. Compare opens a modal showing
the new listing and a match field by field (title, company, role, URL, locations, posted date, deadline,
existing status), starting with the first match. Fields whose values differ SHALL be visually marked.
The modal SHALL offer Open existing, Keep both, and Remove new one.

#### Scenario: Compare one match

- **WHEN** a saved row has one possible duplicate and the user clicks the note's Compare button
- **THEN** a modal shows the new listing's values as "New" and the match's values as "Existing" for each field, with differing fields marked

#### Scenario: Compare is the note's main action

- **WHEN** a saved row shows the possible-duplicate note
- **THEN** the note has a single primary Compare button first, followed by Keep both and Remove new one, and the listed matches have no Compare button of their own

#### Scenario: Switch between several matches

- **WHEN** a saved row has two possible duplicates and the user opens Compare
- **THEN** the modal opens on the first match and shows a "Compare with" selector, and choosing the second match replaces the Existing values without closing the modal

#### Scenario: Single match has no selector

- **WHEN** the row has exactly one possible duplicate
- **THEN** the modal shows no "Compare with" selector

#### Scenario: Keep both from the modal

- **WHEN** the user clicks Keep both in the modal
- **THEN** the modal closes and the row's possible-duplicate note is dismissed, as with the note's own Keep both

#### Scenario: Remove the new one from the modal

- **WHEN** the user clicks Remove new one in the modal
- **THEN** the modal closes and the existing remove confirmation opens for that row's new listing

#### Scenario: Narrow screen

- **WHEN** the modal is open on a phone-width screen
- **THEN** each field shows its label with the New and Existing values stacked beneath it, each tagged, rather than in two columns

## ADDED Requirements

### Requirement: Quick-add groups saved rows by whether they need a look

Once at least one quick-add row is saved, the page SHALL show saved rows with an open flag (possible
duplicate or applied before) under "Needs a look (N)", saved rows without one in a collapsible
"N listings added" group, and unsaved rows under "Not saved (N)" just above Save. A section with no rows
SHALL be hidden. Before any save the page SHALL show rows as it does today, without headings.

#### Scenario: Mixed batch

- **WHEN** a batch saves with one possible duplicate, two clean rows, and one failed row
- **THEN** "Needs a look (1)" shows the flagged row in full, "2 listings added" shows as a closed group, and "Not saved (1)" shows the failed row above Save

#### Scenario: Clean batch

- **WHEN** every row in a batch saves with no flags
- **THEN** only the "N listings added" group shows, closed

#### Scenario: Open the added group

- **WHEN** the user opens the "N listings added" group
- **THEN** each added listing shows as one line with its title linking to the listing and its company and role

#### Scenario: Resolving a flag moves the row

- **WHEN** the user clicks Keep both on the only flagged row
- **THEN** the row moves into the added group, its count goes up by one, and the "Needs a look" section disappears

#### Scenario: Removing a flagged row

- **WHEN** the user confirms Remove new one on a flagged row
- **THEN** the listing is deleted and the row leaves the page, as today

### Requirement: Acknowledge a previous application

A saved quick-add row's "Applied to this URL before" note SHALL offer a Got it button that clears the
note. A row whose only remaining flag is cleared SHALL count as added.

#### Scenario: Got it on an applied-before row

- **WHEN** a saved row is flagged only as applied before and the user clicks Got it
- **THEN** the note disappears and the row moves into the "N listings added" group

#### Scenario: Both flags

- **WHEN** a saved row has a possible duplicate and an applied-before note and the user clicks Got it
- **THEN** the applied-before note disappears and the row stays under "Needs a look" until the duplicate note is resolved

### Requirement: Flagged-row links keep the quick-add page

Links to matching or previously applied listings inside a flagged row's notes SHALL open in a new tab.

#### Scenario: Follow a match link

- **WHEN** the user clicks a possible-duplicate match title
- **THEN** the listing opens in a new tab and the quick-add page keeps its rows
