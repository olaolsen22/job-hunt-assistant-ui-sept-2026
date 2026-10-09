# Proposal

## Why

On the company page, locations are a single muted line in the header. That line can't say which
locations you prefer (the API's `Location.isTarget`) or how many of the company's listings are at
each one. A Locations card shows both at a glance.

## What Changes

- Add a Locations card to the company page, in the right column above Notes. Each row shows:
  - the city (if any) and the country name
  - how many of the company's listings are at that location (archived ones included)
  - a small "Preferred" badge when the location is a target (text, not an icon with a tooltip, so it
    reads on touch screens too)
- Rows are sorted with preferred locations first, then by listing count (highest first), then by name.
- With no locations, the card says so and links to Edit.
- The header's locations line is removed, since the card replaces it.

Out of scope:

- Marking a location as preferred from the UI. `saveLocation(isTarget)` exists, but no screen uses it
  yet, so the flag is whatever the API holds.
- Linking a location to a filtered `/listings` view.
- Showing locations or the preferred mark anywhere else (company rows, listing cards).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `company-details`: adds Company locations and Location order requirements. The page still shows
  locations, now in the card rather than the header. The capability comes from the unarchived
  `company-details-and-avoid` change, so archive that one first.

## Impact

- `app/pages/companies/[id]/index.vue`:
  - the `CompanyPage` query adds `id isTarget` to company locations, and `locations { location { id } }`
    to both listing fields
  - a new card, a sorted `locations` computed, and the header line removed
- `test/unit/CompanyPage.test.ts`: fixtures gain location ids, the header assertion moves to the
  card, and a sort/indicator test is added.
- No new packages or API changes.
