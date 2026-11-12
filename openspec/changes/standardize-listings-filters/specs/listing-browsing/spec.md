## MODIFIED Requirements

### Requirement: Collapsible filter panel

The listings page SHALL arrange its controls in this order at every screen size: the view (presets) with the sort control, then one search row holding the search box, a Favorites toggle, a Preferred locations toggle and a Filters button, then the active-filter chips. All other facets SHALL sit in the Filters sheet, closed by default and opened with the button. The Filters button SHALL show how many facets inside the sheet are active, so a closed sheet does not hide that the list is filtered. Search, Favorites and Preferred locations SHALL stay usable while the sheet is closed.

#### Scenario: Phone default

- **WHEN** the user opens `/listings` on a phone-sized screen
- **THEN** the page shows the View and Sort selects side by side, a full-width search box, and one row with Favorites, Preferred locations and Filters, and the sheet is closed

#### Scenario: Desktop default

- **WHEN** the user opens `/listings` on a tablet or desktop-sized screen
- **THEN** the page shows the preset tabs with Sort at the right of the same row, and the search row with labelled Favorites, Preferred locations and Filters buttons, and the sheet is closed

#### Scenario: Narrow tablet

- **WHEN** the tabs and Sort do not fit on one row
- **THEN** the tabs scroll sideways or Sort wraps below them, and neither overlaps the other

#### Scenario: Opening the panel

- **WHEN** the user clicks Filters
- **THEN** the sheet opens with the groups Status, Location, Role, Language, Skills and Dates, and every change applies right away

#### Scenario: Active facets while closed

- **WHEN** two facets inside the sheet are active and the sheet is closed
- **THEN** the Filters button shows 2

## ADDED Requirements

### Requirement: Quick toggles live in the Filters sheet

Norway only, the Role choice (Any / IT / Non-IT), English posting and English mentioned SHALL be controls in the Filters sheet, each toggle showing how many listings it would leave under the active preset, facets and search. Choosing IT or Non-IT SHALL clear the other. Each of these facets, when on, SHALL appear as a removable chip and count toward the Filters badge. Favorites and Preferred locations SHALL stay inline, show their on/off state, and not count toward the badge. The URL parameters for all of these facets SHALL stay as they are.

#### Scenario: Role is one control

- **WHEN** the user opens the sheet and picks IT, then picks Non-IT
- **THEN** only Non-IT is active, the list shows non-IT listings and one Role chip is shown

#### Scenario: Sheet toggle shown as a chip

- **WHEN** the user turns on Norway only in the sheet and closes it
- **THEN** a "Norway only" chip is shown, the Filters badge counts it, and removing the chip turns the toggle off

#### Scenario: Inline toggle

- **WHEN** the user turns on Preferred locations
- **THEN** the button shows its on state, the list narrows, and the Filters badge does not change

#### Scenario: Existing link

- **WHEN** the user opens `/listings?it=1&englishMentioned=1`
- **THEN** the Role control shows IT, English mentioned is on in the sheet, and both appear as chips
