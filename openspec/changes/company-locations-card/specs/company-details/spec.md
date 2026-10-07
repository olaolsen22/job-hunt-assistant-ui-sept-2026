# Spec Delta

## ADDED Requirements

### Requirement: Company locations

The company page SHALL list the company's locations in a card. Each row SHALL show the city (if any)
and country name, and how many of the company's listings (archived included) are at that location.
A location the user prefers (a target location) SHALL carry a small preferred indicator. With no
locations, the card SHALL say so and link to Edit.

#### Scenario: Locations with listings

- **WHEN** the company is in Oslo and Stockholm, and two of its listings are in Oslo
- **THEN** the card shows "Oslo, Norway" with 2 listings and "Stockholm, Sweden" with 0 listings

#### Scenario: Preferred location

- **WHEN** Stockholm is a target location and Oslo is not
- **THEN** Stockholm's row shows a small "Preferred" badge after its name, and Oslo's does not

#### Scenario: No locations

- **WHEN** the company has no locations
- **THEN** the card says there are no locations and offers Edit

### Requirement: Location order

The Locations card SHALL list preferred locations first, then the rest. Within each group, locations
SHALL be ordered by listing count, highest first, then by name.

#### Scenario: Preferred first

- **WHEN** Oslo has 3 listings, Bergen 0 and Stockholm 1, and only Bergen is preferred
- **THEN** the order is Bergen, Oslo, Stockholm

#### Scenario: Ties by name

- **WHEN** two non-preferred locations have the same listing count
- **THEN** they are ordered alphabetically
