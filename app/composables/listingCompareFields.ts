import type { ResultOf } from 'gql.tada'

// Selected on both the saved quick-add listing and its possible duplicates, so the compare modal
// gets both sides from the save response.
export const LISTING_COMPARE_FIELDS = graphql(`
  fragment ListingCompareFields on Listing {
    id
    title
    url
    postedOn
    deadlineType
    deadlineOn
    status
    company {
      name
    }
    jobRole {
      name
    }
    locations {
      location {
        city
        countryCode
      }
    }
  }
`)

export type ComparedListing = ResultOf<typeof LISTING_COMPARE_FIELDS>
export type PossibleDuplicate = ComparedListing & { archivedAt?: string | null }

// createListing reports possible duplicates only in its response, so the listing page reads them
// from here after the add page has moved on. A reload forgets them.
export const usePossibleDuplicates = () =>
  useState<{ listing: ComparedListing; matches: PossibleDuplicate[] } | null>(
    'listing-possible-duplicates',
    () => null
  )
