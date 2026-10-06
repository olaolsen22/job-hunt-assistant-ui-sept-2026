# listing-browsing Specification

## Purpose

Covers the `/listings` page: which listings it shows by default, its filters, text search, the
order, and pagination.

## Requirements

### Requirement: Default list

With no filter, the list SHALL show non-archived listings, excluding Date listings whose deadline
has passed. It SHALL keep the server's default order: upcoming by due date, then expired by due
date, then newest added.

#### Scenario: Default order

- **WHEN** the user opens `/listings` with no filter
- **THEN** listings appear in the server's order and no client sort is applied

### Requirement: Closing soon filter

The page SHALL offer a "closing soon" preset. It shows non-archived listings due within the next
7 days, including today, and excludes expired ones. Its button SHALL show the count. Like the other
presets, it is mutually exclusive with them and clicking it again clears it. It combines with the
facets and the search.

#### Scenario: Turning on closing soon

- **WHEN** the user clicks the "closing soon" button
- **THEN** only listings with `dueOn` between today and today + 7 days are shown, the list goes back to page 1, and the button shows as active

#### Scenario: No listings closing soon

- **WHEN** no listing is due within 7 days and the preset is not active
- **THEN** the "closing soon" button is hidden, like other presets with a zero count

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

### Requirement: Presets

The page SHALL offer the presets "closing soon", "to analyze" and "archived", each with a count. At most one preset is active at a time; clicking the active preset clears it. A preset whose count is zero SHALL be hidden unless it is active. There is no "active applications" preset: the status facet covers it.

#### Scenario: Switching preset

- **WHEN** "closing soon" is active and the user clicks "archived"
- **THEN** only "archived" is active and the list goes back to page 1

#### Scenario: No active-applications preset

- **WHEN** the user opens `/listings`
- **THEN** no preset button filters to applied or interviewing listings; the status facet does that

### Requirement: Facet filters

The page SHALL offer these facets: favorites only (toggle), status (multi), skill (multi), location (multi), posting language (multi) and required language (multi). Posting language is the language the ad is written in; required language is a language the job asks for. Facets apply together with AND. Within one multi facet, a listing matches if it has any of the selected values. A facet with nothing selected SHALL NOT restrict the list. Changing a facet SHALL go back to page 1.

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

### Requirement: Status facet and expired deadlines

The default list and the "to analyze" preset exclude Date listings whose deadline has passed. When the status facet has at least one value selected, that exclusion SHALL NOT apply, so applications stay visible past their deadline. The "closing soon" preset always excludes expired listings.

#### Scenario: Applied listing past its deadline

- **WHEN** a listing with status applied has a deadline in the past
- **THEN** it is hidden with no status selected and shown once the status "applied" is selected

#### Scenario: Expired saved listing

- **WHEN** the status "saved" is selected and a saved listing's deadline has passed
- **THEN** that listing is shown

### Requirement: Facets combine with presets and search

Facets SHALL combine with the active preset and with the text search. Preset counts SHALL reflect the active facets and the search.

#### Scenario: Facet with a preset

- **WHEN** "closing soon" is active and the user selects the status "saved"
- **THEN** only saved listings due within 7 days are shown, and the other preset counts also count only saved listings

#### Scenario: Facet with search

- **WHEN** the user searches "frontend" and turns on "favorites only"
- **THEN** only favorited listings matching "frontend" are shown

#### Scenario: Archived with a facet

- **WHEN** "archived" is active and "favorites only" is on
- **THEN** only archived favorites are shown

### Requirement: Sort

The page SHALL have a sort dropdown with "Due date" (default), "Newest added" and "Recently changed". "Due date" keeps the server's default order. "Newest added" orders by creation time, newest first. "Recently changed" orders by the time of the latest status change, newest first. Changing the sort SHALL go back to page 1. Descending due date is not offered.

#### Scenario: Default sort

- **WHEN** the user opens `/listings`
- **THEN** the dropdown shows "Due date" and the list is in the server's default order

#### Scenario: Newest added

- **WHEN** the user picks "Newest added"
- **THEN** listings are shown newest created first, with the active preset, facets and search still applied

### Requirement: Collapsible filter panel

The listings page SHALL show one toolbar containing the search box, the sort dropdown and a Filters toggle. The facets SHALL sit in a panel under the toolbar that is closed by default on every screen size and opened with the toggle. The toggle SHALL show how many facets are active, so a closed panel does not hide that the list is filtered. Sort and search SHALL stay visible while the panel is closed.

#### Scenario: Phone default

- **WHEN** the user opens `/listings` on a phone-sized screen
- **THEN** the toolbar shows search, sort and the Filters toggle, and the facet panel is closed

#### Scenario: Desktop default

- **WHEN** the user opens `/listings` on a desktop-sized screen
- **THEN** the toolbar shows the same controls and the facet panel is closed

#### Scenario: Opening the panel

- **WHEN** the user clicks the Filters toggle
- **THEN** the six facets are shown under the toolbar, and clicking again hides them

#### Scenario: Active facets while closed

- **WHEN** two facets are active and the panel is closed
- **THEN** the toggle shows that 2 filters are active

### Requirement: Clearing filters

When any facet is active, the toolbar SHALL offer a way to clear all facets at once, available while the panel is closed. The empty state for a filtered list SHALL keep that control and the toolbar reachable.

#### Scenario: Clear all

- **WHEN** the user clicks "clear" with three facets active
- **THEN** every facet is cleared and the list returns to the preset and search results without facets

#### Scenario: Clear while closed

- **WHEN** a facet is active and the panel is closed
- **THEN** the clear control is still visible in the toolbar
