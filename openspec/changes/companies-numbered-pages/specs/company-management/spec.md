# Spec Delta

## MODIFIED Requirements

### Requirement: Companies list

The `/companies` page SHALL list the user's companies with name, industry, locations, listing count
and application count, ordered by name. It SHALL have a search box that matches company names, and
numbered pages like `/listings` that move through the results. Each row SHALL link to `/listings`
searching for that company's name. An "Add companies" button SHALL lead to `/companies/add`.

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
- **THEN** `/listings` opens with the search box filled with the company's name

#### Scenario: No companies

- **WHEN** the user has no companies
- **THEN** an empty state points to "Add companies"
