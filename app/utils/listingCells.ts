import type { ListingListItem } from '~/composables/useListingsList'
import { SENIORITY_OPTIONS } from '~/constants/listing'

// Plain functions rather than computeds, so the table can call them per cell.

export const listingFirstLocation = ({ locations: [first] }: ListingListItem) =>
  first ? formatLocation(first.location) : 'Location not specified'

export const listingMoreLocations = ({ locations }: ListingListItem) =>
  Math.max(0, locations.length - 1)

export const listingSeniority = ({ seniority }: ListingListItem) =>
  SENIORITY_OPTIONS.find((o) => o.value === seniority)?.label ?? null
