# Spec Delta

## Purpose

Covers the `/listings` page: which listings it shows by default, its filters, text search, the
order, and pagination.

## ADDED Requirements

### Requirement: Default list

With no filter, the list SHALL show non-archived listings, excluding Date listings whose deadline
has passed. It SHALL keep the server's default order: upcoming by due date, then expired by due
date, then newest added.

#### Scenario: Default order

- **WHEN** the user opens `/listings` with no filter
- **THEN** listings appear in the server's order and no client sort is applied

### Requirement: Closing soon filter

The page SHALL offer a "closing soon" filter. It shows non-archived listings due within the next
7 days, including today, and excludes expired ones. Its button SHALL show the count. Like the other
filters, it is mutually exclusive with them and clicking it again clears it.

#### Scenario: Turning on closing soon

- **WHEN** the user clicks the "closing soon" filter button
- **THEN** only listings with `dueOn` between today and today + 7 days are shown, the list goes back to page 1, and the button shows as active

#### Scenario: No listings closing soon

- **WHEN** no listing is due within 7 days and the filter is not active
- **THEN** the "closing soon" button is hidden, like other filters with a zero count

### Requirement: Text search

The page SHALL have a search box. It matches listing title, company name, and job role name,
case-insensitively and including æøå (server-side). Typing SHALL be debounced and SHALL reset to
page 1. A blank search SHALL show the unfiltered list. Search SHALL combine with the active
filter, and the filter counts SHALL reflect the search.

#### Scenario: Searching

- **WHEN** the user types "bekk" in the search box
- **THEN** after the debounce, only listings whose title, company, or job role contains "bekk" are shown, starting at page 1

#### Scenario: Search with a filter

- **WHEN** the "archived" filter is active and the user searches "frontend"
- **THEN** only archived listings matching "frontend" are shown

#### Scenario: No matches

- **WHEN** a search matches nothing
- **THEN** the empty state says no listings match, and the search box and filters stay visible so the user can clear them

#### Scenario: Clearing the search

- **WHEN** the user clears the search box
- **THEN** the list returns to the unsearched results for the active filter
