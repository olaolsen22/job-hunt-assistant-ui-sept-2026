# company-management Specification

## Purpose

Lets the user see the companies they have and add many at once, with industry and locations, by
parsing pasted text and checking the rows before anything is saved.

## Requirements

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

### Requirement: Company parsing input

The `/companies/add` page SHALL turn pasted text (company names, or a page about companies) into
editable rows, either with the built-in parser or by copying the company prompt to an external AI and
pasting its JSON array back. Pasting more SHALL append rows and never drop rows already there. Nothing
is saved until the user saves.

#### Scenario: Built-in parser

- **WHEN** the user ticks "Use built-in parser", pastes text and clicks "Parse into rows"
- **THEN** one preview row appears per company in the reply

#### Scenario: Copy-paste parser

- **WHEN** the user copies the prompt, pastes the AI's reply (even wrapped in a code fence) and clicks "Parse into rows"
- **THEN** one preview row appears per company

#### Scenario: Unreadable reply

- **WHEN** the reply is not a JSON array or holds no companies
- **THEN** an error is shown under the reply box and no rows are added

#### Scenario: Pasting more

- **WHEN** rows are already present and the user pastes and parses again
- **THEN** the new rows are appended below the existing ones

### Requirement: Company preview rows

Each preview row SHALL let the user edit the name, the industry (typed, or picked from existing
industries, like the company field on a listing) and the locations (country plus optional city). The
page SHALL check the rows right after parsing and before saving, and show what is missing or invalid
next to the field. Rows can be removed, and a blank row added by hand. A blank row is not saved.

#### Scenario: AI left a name out

- **WHEN** a parsed row has no name
- **THEN** the row shows "Required" next to Name straight away and Save does not send it

#### Scenario: Industry unknown to the API

- **WHEN** the user types an industry that does not exist yet
- **THEN** it is accepted and will be created on save

#### Scenario: Fixing a location

- **WHEN** the AI returned a wrong country for a row
- **THEN** the user changes the country and city in the row before saving

### Requirement: Saving companies

Save SHALL send all unsaved rows in one request. When it succeeds, each row SHALL turn into a result
card with the company name. A company that already existed SHALL say it already existed and was left
unchanged, since its industry and locations are not updated. When the request fails, nothing is saved:
the page SHALL show the error once above the rows and keep every row as it was.

#### Scenario: All new

- **WHEN** the user saves three new companies
- **THEN** three result cards appear and a toast says "3 companies added"

#### Scenario: One already existed

- **WHEN** one of the rows has the name of an existing company
- **THEN** its card says it already existed and was left unchanged, and the toast counts only the new ones

#### Scenario: A row is rejected by the API

- **WHEN** the API reports an invalid company or location error
- **THEN** no cards appear, the error message is shown above the rows, and the rows stay editable

#### Scenario: Names created by a save appear in dropdowns

- **WHEN** a save creates new companies or industries
- **THEN** the company and industry dropdowns include them without a reload

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
