# Spec Delta

## ADDED Requirements

### Requirement: Companies view kept in the URL

`/companies` SHALL keep its search and page number in the URL, updated without adding a browser
history entry, and SHALL restore them when the page opens. An empty search and page 1 SHALL be
left out of the URL. A page number that is not a positive number SHALL be ignored.

#### Scenario: Back from a company's listings

- **WHEN** the user searches "consult", moves to page 2, clicks a company row and presses the browser back button
- **THEN** `/companies` shows the search "consult" and page 2

#### Scenario: Opening a later page

- **WHEN** the user opens `/companies` with page 3 in the URL
- **THEN** page 3 is shown and the pager marks page 3 as current

#### Scenario: Page past the end

- **WHEN** the URL names a page beyond the last page
- **THEN** the last page is shown
