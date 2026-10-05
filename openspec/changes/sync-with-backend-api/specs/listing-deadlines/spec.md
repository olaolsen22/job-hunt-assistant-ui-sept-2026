# Spec Delta

## Purpose

Defines the deadline types a listing can have and how the UI shows its due date and urgency. The
due date comes from the server, so the list order and the badges agree.

## ADDED Requirements

### Requirement: Deadline types

The UI SHALL offer exactly the deadline types the API accepts: Date, ASAP, and Not stated
(`DATE`, `ASAP`, `UNSPECIFIED`). A deadline date input SHALL be shown only for Date.

#### Scenario: Picking a deadline type

- **WHEN** the user opens the Deadline select on the listing form or a quick-add row
- **THEN** the options are Date, ASAP, and Not stated, and there is no Rolling option

#### Scenario: Date needs a date

- **WHEN** the user picks Date and leaves the deadline date empty
- **THEN** the form shows "Pick a date" and does not submit

### Requirement: Due date comes from the server

The UI SHALL take a listing's due date from the API's `dueOn`. It SHALL NOT compute it from the
deadline type and posted date. A listing is expired when `dueOn` is before the user's local today.

#### Scenario: ASAP listing

- **WHEN** an ASAP listing has `dueOn` 6 days from today
- **THEN** the deadline line reads "ASAP, due ~<dueOn>" and is colored for 6 days left

#### Scenario: Not stated listing

- **WHEN** a Not stated listing has `dueOn` 20 days from today
- **THEN** the deadline line reads "Not stated, due ~<dueOn>" and is colored for 20 days left

#### Scenario: Dated listing

- **WHEN** a Date listing has `deadlineOn` 2 days from today
- **THEN** the deadline line shows the formatted deadline date, colored for 2 days left

### Requirement: Expired deadlines

An expired listing's deadline line SHALL be red. A Date listing SHALL show "<date>, expired".
ASAP and Not stated listings SHALL show "<type>, likely filled".

#### Scenario: Expired ASAP listing

- **WHEN** an ASAP listing's `dueOn` was yesterday
- **THEN** the deadline line reads "ASAP, likely filled" in red

#### Scenario: Expired dated listing

- **WHEN** a Date listing's deadline was yesterday and the listing is shown (e.g. under active applications)
- **THEN** the deadline line reads "<date>, expired" in red

### Requirement: Posted date

The posted line SHALL show the posted date, colored by how many days ago it was posted, for every
deadline type.

#### Scenario: Posted today

- **WHEN** a listing was posted today
- **THEN** the posted line shows today's date in the "fresh" color
