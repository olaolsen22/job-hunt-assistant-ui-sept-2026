# Spec Delta

## MODIFIED Requirements

### Requirement: Companies list

The `/companies` page SHALL list the user's companies with name, industry, locations, listing count
and application count, ordered by name. It SHALL have a search box that matches company names, and
numbered pages like `/listings` that move through the results. Each row SHALL link to that company's
page at `/companies/<id>`. An "Add companies" button SHALL lead to `/companies/add`.

#### Scenario: Browsing pages

- **WHEN** the user has more companies than fit on one page and clicks a page number
- **THEN** that page's companies are shown, and clicking page 1 brings the first ones back

#### Scenario: Everything fits on one page

- **WHEN** the user has no more companies than fit on one page
- **THEN** no pager is shown

#### Scenario: Searching

- **WHEN** the user types "bekk" in the search box
- **THEN** after the debounce, only companies whose name contains "bekk" are shown, starting at the first page

#### Scenario: Opening a company's listings

- **WHEN** the user clicks a company row
- **THEN** that company's page opens with its listings, instead of a `/listings` search

#### Scenario: No companies

- **WHEN** the user has no companies
- **THEN** an empty state points to "Add companies"

### Requirement: Company favorites

Each row on `/companies` SHALL have a favorite toggle that sets or clears the company's favorite
mark. The toggle SHALL update at once, undo itself and show an error if the API rejects the change,
and SHALL NOT open the company's page when clicked.

#### Scenario: Favoriting a company

- **WHEN** the user clicks the star on a company row
- **THEN** the star shows as filled and the company is saved as a favorite

#### Scenario: Unfavoriting

- **WHEN** the user clicks the filled star on a favorited company
- **THEN** the star is cleared and the favorite mark is removed

#### Scenario: Save fails

- **WHEN** the API returns an error for the change
- **THEN** the star returns to its previous state and an error toast shows the message

#### Scenario: Row link is not triggered

- **WHEN** the user clicks the star
- **THEN** the company's page does not open

## ADDED Requirements

### Requirement: Hide avoided companies

`/companies` SHALL have a "Hide avoided" toggle, off by default. When on, avoided companies SHALL
be left out of the list, the count and the pages, and the list SHALL start at the first page. The
toggle state SHALL be kept in the URL, like the search.

#### Scenario: Default shows everyone

- **WHEN** the user opens `/companies` with no query
- **THEN** avoided companies are listed along with the rest

#### Scenario: Hiding avoided

- **WHEN** the user turns on "Hide avoided"
- **THEN** only companies that are not avoided are shown, starting at the first page, and the URL records the toggle

#### Scenario: Coming back

- **WHEN** the user opens a company from the filtered list and goes back
- **THEN** the list still hides avoided companies

#### Scenario: Nothing left

- **WHEN** "Hide avoided" is on and every matching company is avoided
- **THEN** an empty message says no companies match, and the toggle stays visible to turn it off

### Requirement: Avoided badge on company rows

A row for an avoided company SHALL show an "Avoided" badge next to its other badges.

#### Scenario: Avoided row

- **WHEN** a company in the list is avoided
- **THEN** its row shows an "Avoided" badge
