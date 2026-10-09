# Spec Delta

## ADDED Requirements

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
