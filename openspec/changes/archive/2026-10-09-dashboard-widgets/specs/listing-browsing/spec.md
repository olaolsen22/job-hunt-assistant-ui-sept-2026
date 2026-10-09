## ADDED Requirements

### Requirement: Starting state from the URL

`/listings` SHALL accept a preset, statuses and the favorites facet in the URL and apply them when
the page opens, so other pages can link to a filtered list. Unknown values SHALL be ignored. The
applied filters SHALL behave exactly as if the user had picked them in the page.

#### Scenario: Opening with a preset

- **WHEN** the user opens `/listings` with the closing soon preset in the URL
- **THEN** the closing soon preset is active and the list shows only listings due within 7 days

#### Scenario: Opening with statuses

- **WHEN** the user opens `/listings` with the status Offer in the URL
- **THEN** the status facet shows Offer selected, the filter panel's active count includes it, and past-deadline listings with that status are shown

#### Scenario: Opening with favorites

- **WHEN** the user opens `/listings` with the favorites facet in the URL
- **THEN** only favorited listings are shown

#### Scenario: Unknown value

- **WHEN** the URL names a preset or status that does not exist
- **THEN** it is ignored and the default list is shown
