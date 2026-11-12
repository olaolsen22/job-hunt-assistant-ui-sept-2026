## MODIFIED Requirements

### Requirement: Collapsible filter panel

The listings page SHALL arrange its controls in three rows at every screen size: the view row (presets, with the sort control), the find row (search box and a Filters button), and the quick-filter row. Rarer facets SHALL sit in the Filters sheet, closed by default and opened with the button. The Filters button SHALL show how many facets inside the sheet are active, so a closed sheet does not hide that the list is filtered. No control SHALL be clipped or cause sideways page scrolling at any width.

#### Scenario: Phone default

- **WHEN** the user opens `/listings` on a 375px-wide screen
- **THEN** the View and Sort selects share the first row, the search box and a fully visible Filters button share the second, the quick filters sit in a third row that scrolls sideways within itself, and the sheet is closed

#### Scenario: Desktop default

- **WHEN** the user opens `/listings` on a desktop-sized screen
- **THEN** the tabs sit left and Sort right on the first row, search fills the second with Filters at the same right edge as Sort, and all quick filters are visible on the third, wrapping rather than scrolling

#### Scenario: Opening the panel

- **WHEN** the user clicks the Filters button
- **THEN** the sheet opens with the groups Status, Location, Language, Skills and Dates, and every change applies right away

#### Scenario: Active facets while closed

- **WHEN** two facets inside the sheet are active and the sheet is closed
- **THEN** the Filters button shows 2

## ADDED Requirements

### Requirement: Quick filter pills

The quick-filter row SHALL show these pills in this order: Favorites, Preferred, Norway only, IT roles, Non-IT roles, English posting, English mentioned. Each is a toggle that shows its on/off state, and each except Favorites shows how many listings it would leave under the active preset, facets and search. IT roles and Non-IT roles SHALL be mutually exclusive. Pills SHALL NOT count toward the Filters badge, SHALL NOT appear as chips, and SHALL be reset by Clear all but not by the sheet's own Clear. The URL parameters for these facets SHALL stay as they are.

#### Scenario: Turning a pill on

- **WHEN** the user turns on "Norway only"
- **THEN** the pill shows its on state, the list narrows, and the Filters badge does not change

#### Scenario: IT and Non-IT

- **WHEN** "IT roles" is on and the user clicks "Non-IT roles"
- **THEN** only "Non-IT roles" is on

#### Scenario: Clearing

- **WHEN** pills are on and the user clicks the sheet's Clear filters
- **THEN** the pills stay on; "Clear all" resets them

#### Scenario: Existing link

- **WHEN** the user opens `/listings?it=1&englishMentioned=1`
- **THEN** the "IT roles" and "English mentioned" pills show as on
