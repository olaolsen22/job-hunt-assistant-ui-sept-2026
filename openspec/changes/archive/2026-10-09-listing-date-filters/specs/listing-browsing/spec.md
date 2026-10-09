# Spec Delta

## MODIFIED Requirements

### Requirement: Facet filters

The page SHALL offer these facets: favorites only (toggle), status (multi), skill (multi), location (multi), posting language (multi), required language (multi), posted date and due within. Posting language is the language the ad is written in; required language is a language the job asks for. Facets apply together with AND. Within one multi facet, a listing matches if it has any of the selected values. A facet with nothing selected SHALL NOT restrict the list. Changing a facet SHALL go back to page 1.

#### Scenario: Favorites only

- **WHEN** the user turns on "favorites only"
- **THEN** only favorited listings are shown

#### Scenario: Status any-of

- **WHEN** the user selects the statuses "applied" and "interviewing"
- **THEN** listings with either status are shown and listings with other statuses are not

#### Scenario: Skill any-of

- **WHEN** the user selects the skills "Vue" and "TypeScript"
- **THEN** listings that list at least one of them are shown

#### Scenario: Location any-of

- **WHEN** the user selects the locations "Oslo, NO" and "Bergen, NO"
- **THEN** listings in at least one of them are shown

#### Scenario: Posting and required language

- **WHEN** the user selects posting language "Norwegian" and required language "English"
- **THEN** only listings written in Norwegian that require English are shown

#### Scenario: Combining facets

- **WHEN** "favorites only" is on and the status "applied" is selected
- **THEN** only favorited listings with status applied are shown

#### Scenario: Clearing a facet

- **WHEN** the user removes every selected value from a multi facet
- **THEN** that facet no longer restricts the list

## ADDED Requirements

### Requirement: Posted date filter

The panel SHALL offer "From" and "To" date inputs on the posted date. Each is optional and both ends are inclusive. The filter SHALL NOT remove the default exclusion of listings past their deadline.

#### Scenario: Range

- **WHEN** the user sets From 1 Oct and To 7 Oct
- **THEN** only listings posted from 1 Oct through 7 Oct are shown

#### Scenario: One end

- **WHEN** the user sets only From
- **THEN** listings posted on or after that date are shown

### Requirement: Due within filter

The panel SHALL offer a "Due within" select with Any, 3, 7, 14 and 30 days. A value shows listings whose server due date (`dueOn`) is between today and that many days ahead, today included, expired ones excluded. ASAP and Not stated listings match through their computed due date. With "closing soon" also active, both apply, so the narrower window decides.

#### Scenario: Not stated listing

- **WHEN** a Not stated listing has `dueOn` 10 days from today
- **THEN** it is shown under "Due within 14 days" and hidden under "Due within 7 days"

#### Scenario: With closing soon

- **WHEN** "closing soon" is active and the user picks "Due within 3 days"
- **THEN** only listings due within 3 days are shown

### Requirement: Date filters in the URL

Both filters SHALL be stored in the URL like the other facets, with unknown values ignored. Each counts once toward the active count (From and To together are one), and Clear all resets both.

#### Scenario: Restoring from the URL

- **WHEN** the user opens `/listings` with a posted range and Due within 7 days in the URL
- **THEN** the inputs show those values and the active count includes both

#### Scenario: Clear all

- **WHEN** both filters are set and the user clicks "Clear all"
- **THEN** the dates are empty and Due within shows Any
