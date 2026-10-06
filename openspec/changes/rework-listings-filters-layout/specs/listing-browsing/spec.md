## MODIFIED Requirements

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
