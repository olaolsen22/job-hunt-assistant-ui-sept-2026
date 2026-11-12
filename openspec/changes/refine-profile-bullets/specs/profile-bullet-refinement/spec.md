# Spec Delta

## Purpose

Lets the owner improve profile bullets with AI, for the whole profile or one entry, by reviewing each
suggestion beside the current text before anything is saved.

## ADDED Requirements

### Requirement: Scoped entry points

The profile page SHALL offer "Refine bullets with AI" for the whole profile, and each entry that has
bullets SHALL offer it in its actions menu for that entry only. Entries without bullets SHALL NOT offer it.
The modal title SHALL name the scope.

#### Scenario: Entry scope

- **WHEN** the owner chooses Refine bullets with AI on an entry with bullets
- **THEN** the request carries that entry's kind and id and no bullet id

#### Scenario: Entry without bullets

- **WHEN** an entry has no bullets
- **THEN** its menu has no refine item

#### Scenario: Whole profile

- **WHEN** the owner chooses it from the profile header
- **THEN** the request carries no scope

### Requirement: Suggestion sources

The modal SHALL offer the built-in AI and the owner's own AI. Own AI SHALL show the prompt for the same
scope, and a pasted reply SHALL be previewed through the API. Unreadable pasted JSON SHALL show the
API's error and keep the pasted text.

#### Scenario: Built-in AI

- **WHEN** the owner runs the built-in AI
- **THEN** the review opens with the returned suggestions, and AI safety/limit errors show in the modal

#### Scenario: Unreadable reply

- **WHEN** the preview returns status FAILED
- **THEN** an error shows on the paste step and the pasted text stays

### Requirement: Review before applying

Each suggestion SHALL show the bullet's current text and an editable suggested text, with its entry name,
and be tickable. Apply SHALL send only ticked bullets whose text differs from the current text, in one
call, and SHALL NOT allow an empty text.

#### Scenario: Edit then apply

- **WHEN** the owner edits a suggestion to add a metric and applies
- **THEN** the edited text is sent, the profile refreshes and a success toast shows

#### Scenario: Apply fails

- **WHEN** apply returns an error
- **THEN** the review stays open with the API message

### Requirement: Missing-fact notes

A suggestion's note SHALL be shown on its row. A row with a note and no new text SHALL start unticked with
the current text editable, and SHALL count as applicable only once its text is changed.

#### Scenario: Note only

- **WHEN** a row has a note and null text and the owner leaves it unedited
- **THEN** it is not sent and not counted in Apply

### Requirement: Nothing to change

An empty suggestion list SHALL show a muted "no bullets need changes" state with Close, not an error.

#### Scenario: Empty result

- **WHEN** the API returns success with no bullets
- **THEN** the empty state shows and Apply is absent

### Requirement: Stale translations notice

The review SHALL tell the owner that translations of changed bullets become out of date.

#### Scenario: Notice shown

- **WHEN** the review has applicable rows
- **THEN** the notice is visible
