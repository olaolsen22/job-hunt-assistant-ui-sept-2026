# Spec Delta

## MODIFIED Requirements

### Requirement: Starting state from the URL

`/listings` SHALL accept the search, sort, preset, every facet and the page number in the URL and
apply them when the page opens, so other pages can link to a filtered list and a returning user
gets the same view. Unknown values SHALL be ignored. The applied state SHALL behave exactly as if
the user had picked it in the page.

#### Scenario: Opening with a preset

- **WHEN** the user opens `/listings` with the closing soon preset in the URL
- **THEN** the closing soon preset is active and the list shows only listings due within 7 days

#### Scenario: Opening with statuses

- **WHEN** the user opens `/listings` with the status Offer in the URL
- **THEN** the status facet shows Offer selected, the filter panel's active count includes it, and past-deadline listings with that status are shown

#### Scenario: Opening with favorites

- **WHEN** the user opens `/listings` with the favorites facet in the URL
- **THEN** only favorited listings are shown

#### Scenario: Opening with search, sort, other facets and a page

- **WHEN** the user opens `/listings` with a search, the "Newest added" sort, a skill, a location, a posting language, a required language and page 2 in the URL
- **THEN** the search box, sort dropdown and facets show those values, the Filters toggle counts the active facets, and page 2 of that list is shown

#### Scenario: Page past the end

- **WHEN** the URL names a page beyond the last page of that list
- **THEN** the last page is shown

#### Scenario: Unknown value

- **WHEN** the URL names a preset, status, sort or language that does not exist, or a page that is not a positive number
- **THEN** that value is ignored and its default is used

## ADDED Requirements

### Requirement: View kept in the URL

Whenever the user changes the search (after its debounce), sort, preset, a facet or the page on
`/listings`, the URL SHALL be updated to describe the current view, without adding a browser
history entry. Values at their default (empty search, "Due date", no preset, empty facets, page 1)
SHALL be left out of the URL.

#### Scenario: Back from a listing

- **WHEN** the user filters, moves to page 2, opens a listing and presses the browser back button
- **THEN** `/listings` shows the same search, sort, preset, facets and page as before

#### Scenario: Refresh

- **WHEN** the user refreshes `/listings` after changing the view
- **THEN** the same view is shown

#### Scenario: No extra history entries

- **WHEN** the user changes several filters and then presses the browser back button
- **THEN** the browser leaves `/listings` for the previous page instead of stepping back through the filter changes

#### Scenario: Default view

- **WHEN** every control is at its default and the list is on page 1
- **THEN** the URL is `/listings` with no query

### Requirement: Back from a listing returns to the list view

The listing page's "Back" button SHALL lead to the last `/listings` view the user had in this
session, including its query. With no earlier visit in the session it SHALL lead to `/listings`.

#### Scenario: Back button after editing

- **WHEN** the user opens a listing from a filtered `/listings`, edits and saves it, then clicks "Back"
- **THEN** `/listings` opens with the same filters and page as before

#### Scenario: Opened directly

- **WHEN** the user opens a listing's URL directly and clicks "Back"
- **THEN** `/listings` opens with its default view
