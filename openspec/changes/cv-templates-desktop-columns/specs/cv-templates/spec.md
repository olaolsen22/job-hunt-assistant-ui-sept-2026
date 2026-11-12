# Spec Delta

## MODIFIED Requirements

### Requirement: Template list

`/cv-templates` SHALL list templates as cards in one column below the `xl` breakpoint, two columns from `xl`, and
three from `2xl`. Cards in a row SHALL have equal height. Each card SHALL show:

- the name
- one chip per language with its latest version number
- when it was last updated
- the description, up to two lines

Active and Archived SHALL be tabs, kept in the URL. "New CV template" SHALL go to `/cv-templates/new` without a dialog.
Each card SHALL offer Archive or Restore, and Delete. Loading and empty states SHALL span the full width.

#### Scenario: New template

- **WHEN** the owner clicks New CV template
- **THEN** the create page opens, and nothing is created

#### Scenario: Desktop grid

- **WHEN** the list has several templates on a 1440px-wide screen
- **THEN** they show in two columns

#### Scenario: Phone and tablet

- **WHEN** the list is shown below the `xl` breakpoint
- **THEN** the templates show in one column, as before

## ADDED Requirements

### Requirement: Desktop side rail

From the `lg` breakpoint, the create and editor pages SHALL use a main column and a sticky side rail instead of a
single capped column. The main column SHALL hold the status banner, the Draft with AI and Replace with my profile
actions, and the content editor, whose section cards stay in one column. The rail SHALL hold the Layout card, with
its fields stacked, and on the create page the Details card. A rail taller than the window SHALL scroll on its own.
Below `lg` the pages SHALL keep their single-column order, with the Details card first on the create page.

#### Scenario: Editor on desktop

- **WHEN** the editor is open on a 1440px-wide screen
- **THEN** the content fills the main column and the Layout card sits beside it, staying in view while the content
  scrolls

#### Scenario: Create on phone

- **WHEN** the create page is open on a 375px-wide screen
- **THEN** the Details card shows first, above the content, in one column
