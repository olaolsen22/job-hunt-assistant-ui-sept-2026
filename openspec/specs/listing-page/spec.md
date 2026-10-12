# listing-page Specification

## Purpose

Defines how a single job listing is shown on its own page and edited, including the actions available on it, the
listing form's fields, and the modal that fills the listing in from its ad.

## Requirements

### Requirement: Listing header

The listing page SHALL show, above all cards: the job title with the favorite toggle; one row of same-size badges
(application status, analyzed state, Archived when archived); company, role and locations; the posted and deadline
dates; and a "View ad" link that opens the ad URL in a new tab.

#### Scenario: Header content

- **WHEN** the owner opens a saved, unanalyzed listing
- **THEN** the title, Saved and To analyze badges, company, role, locations, dates and View ad appear before any card

#### Scenario: Archived listing

- **WHEN** the listing is archived
- **THEN** the header shows an Archived badge and a notice with an Unarchive action appears above the cards

### Requirement: Listing actions

The listing page SHALL show Back first and the actions after it. Below the small breakpoint, Back and the actions
SHALL be on separate rows. Edit SHALL be the only solid primary action; "Analyze ad" SHALL be visible; Mark analyzed,
Archive and Unarchive SHALL be in a "More" menu. Mark analyzed SHALL ask for confirmation.

#### Scenario: Mobile toolbar

- **WHEN** the listing page is viewed on a narrow screen
- **THEN** Back is on its own row and Analyze ad, Edit and More are on the row below

#### Scenario: More menu

- **WHEN** the owner opens More on an unanalyzed, unarchived listing
- **THEN** it offers Mark analyzed and Archive; on an analyzed, archived listing it offers only Unarchive

#### Scenario: Analyze ad

- **WHEN** the owner clicks Analyze ad on the listing page
- **THEN** the edit page opens with the analyze-ad modal open

### Requirement: Listing details

The details card SHALL show each field as a muted label above its value. Fields with no value SHALL show
"Not stated" in muted text. Skills SHALL be grouped under "Required" and "Nice to have". Language requirements SHALL
say whether each one is required or optional in text.

#### Scenario: Skills grouping

- **WHEN** a listing has two required skills and one optional skill
- **THEN** the skills card shows the two under Required and the one under Nice to have

#### Scenario: No skills

- **WHEN** a listing has no skills
- **THEN** the skills card says "No skills listed"

### Requirement: Application section

The application card SHALL NOT repeat the status badge from the header. For a saved listing it SHALL say
"Not applied yet" next to the Apply button.

#### Scenario: Saved listing

- **WHEN** the listing's status is Saved
- **THEN** the application card shows "Not applied yet" and Apply, and no status badge

### Requirement: Edit page framing

The edit page SHALL show Back (to the listing) and "Analyze ad" in the same toolbar layout as the listing page, and
the listing's saved title and company as a heading above the form. Saving SHALL still ask for confirmation.

#### Scenario: Heading does not follow typing

- **WHEN** the owner changes the title field
- **THEN** the heading keeps showing the saved title

#### Scenario: Back

- **WHEN** the owner clicks Back on the edit page
- **THEN** the listing page opens and nothing is saved

### Requirement: Filled-from-ad notice

After an analyze-ad result is applied to the form, the add and edit pages SHALL show a dismissible notice above the
form saying the fields were filled from the ad and are not saved yet. On the edit page it SHALL also say fields the
ad didn't mention kept their saved values and that saving marks the listing analyzed.

#### Scenario: After applying a parse on edit

- **WHEN** the owner applies a parse result on the edit page
- **THEN** the notice appears above the form and the listing is not saved

### Requirement: Clearable optional fields

Every optional single-choice field in the listing form (employment type, seniority, ad language, language level,
work mode, schedule) SHALL let the owner set it back to empty after a value was chosen.

#### Scenario: Clearing seniority

- **WHEN** the owner picks Senior and then clears the seniority field
- **THEN** the field shows "Not stated" and saving sends no seniority

### Requirement: Deadline field

The deadline type and its date SHALL be edited in one field; the date input SHALL show only for a dated deadline,
and a missing date SHALL show its error on that field.

#### Scenario: Dated deadline

- **WHEN** the owner sets the deadline type to Date
- **THEN** a date input appears in the same field, next to the type

### Requirement: Skill and language rows

Each skill and language row SHALL keep its name and remove button on one line on narrow screens with the other
controls below; from the small breakpoint up, rows SHALL be single lines under column headers. Every row control
SHALL have an accessible label, and the skill level SHALL read as "Level N".

#### Scenario: Skill row on a phone

- **WHEN** a skill row is shown on a narrow screen
- **THEN** the name and remove button are on the first line and level, min. years and Required on the second

#### Scenario: Remove button label

- **WHEN** a skill named Vue is listed
- **THEN** its remove button is labelled "Remove Vue"

### Requirement: Analyze-ad modal

The analyze-ad modal SHALL be titled "Analyze ad" and offer its methods as tabs: "From link" (only for a saved
listing), "Paste ad" (built-in parser) and "Use your own AI" (copy prompt, paste reply). The footer's main button
SHALL run the active tab's method. Instructions SHALL be in the body. The pasted ad SHALL be kept across tabs.

#### Scenario: Add page

- **WHEN** the modal opens on the add page
- **THEN** it shows Paste ad and Use your own AI, without From link

#### Scenario: Edit page

- **WHEN** the modal opens on the edit page
- **THEN** From link is the first tab, says it reads the saved link, and its button parses that URL

### Requirement: Parsing can't be interrupted

While a parse runs, the modal SHALL NOT close and its tabs SHALL be disabled.

#### Scenario: Close during parse

- **WHEN** a parse is running and the owner presses Escape or clicks outside
- **THEN** the modal stays open

### Requirement: Built-in parse failure stays put

When the built-in parser fails, the modal SHALL show the error inside the Paste ad tab, keep the pasted ad, and stay
on that tab.

#### Scenario: Parser error

- **WHEN** the owner runs Paste ad and the API returns a parse error
- **THEN** the error shows in the tab, the ad text is still there, and the tab does not change

### Requirement: Tailored CV card

The listing page SHALL show a "Tailored CV" card. When the listing has no draft, the card SHALL show a muted empty
state and a "Create draft" button that opens the draft editor. When a draft exists, the card SHALL show a "Draft
saved" badge, an Edit button that opens the editor, and a "Copy as text" button. While the draft loads, the card
SHALL show a loading state. If loading fails, the card SHALL show the error.

#### Scenario: No draft yet

- **WHEN** the listing has no tailored CV draft
- **THEN** the card shows the empty state and "Create draft" links to `/listings/[id]/cv`

#### Scenario: Draft exists

- **WHEN** the listing has a saved draft
- **THEN** the card shows "Draft saved", Edit and "Copy as text"
