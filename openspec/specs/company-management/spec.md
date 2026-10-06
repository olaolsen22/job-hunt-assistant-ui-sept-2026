# company-management Specification

## Purpose

Lets the user see the companies they have and add many at once, with industry and locations, by
parsing pasted text and checking the rows before anything is saved.

## Requirements

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
