import type { DeadlineType } from '~/constants/listing'

export interface ListingListItem {
  id: number
  title: string
  company: { name: string }
  locations: { location: { city: string | null; countryCode: string } }[]
  postedOn: string | null
  deadlineType: DeadlineType
  deadlineOn: string | null
  url: string
}

interface ListingsResult {
  listings: {
    nodes: ListingListItem[]
    pageInfo: {
      hasNextPage: boolean
      hasPreviousPage: boolean
      startCursor: string | null
      endCursor: string | null
    }
    totalCount: number
  }
}

const LISTINGS_PAGE_SIZE = 20

// Deadline soonest first. DeadlineType has no nulls-first/last control, so we sort by the enum
// itself: DATE, ASAP, ROLLING, UNSPECIFIED groups dated listings first, then deadlineOn breaks
// ties within DATE. Assumes the backend stores the enum as its declared int order, not as a
// string (unverified against a live backend).
const LISTINGS_QUERY = `
  query Listings($first: Int, $after: String) {
    listings(
      first: $first
      after: $after
      order: [{ deadlineType: ASC }, { deadlineOn: ASC }, { createdAt: DESC }]
    ) {
      nodes {
        id
        title
        company { name }
        locations { location { city countryCode } }
        postedOn
        deadlineType
        deadlineOn
        url
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      totalCount
    }
  }
`

// Listings need the session cookie and change often; fetching client-only (server: false)
// avoids wiring cookie forwarding into the shared `gql` util for a single, non-SSR-critical page.
export const useListingsList = () => {
  const after = ref<string>()
  // Cursors of pages visited so "Previous" can step back without a "last/before" query.
  const history = ref<string[]>([])

  const { data, status, error, refresh } = useAsyncData(
    'listings',
    () => gql<ListingsResult>(LISTINGS_QUERY, { first: LISTINGS_PAGE_SIZE, after: after.value }),
    { watch: [after], server: false }
  )

  const pageInfo = computed(() => data.value?.listings.pageInfo)

  const nextPage = () => {
    const info = pageInfo.value
    if (!info?.hasNextPage || !info.endCursor) return
    history.value.push(after.value ?? '')
    after.value = info.endCursor
  }

  const prevPage = () => {
    const prev = history.value.pop()
    after.value = prev || undefined
  }

  return {
    listings: computed(() => data.value?.listings.nodes ?? []),
    totalCount: computed(() => data.value?.listings.totalCount ?? 0),
    hasNextPage: computed(() => pageInfo.value?.hasNextPage ?? false),
    hasPrevPage: computed(() => history.value.length > 0),
    loading: computed(() => status.value === 'pending'),
    error,
    nextPage,
    prevPage,
    refresh
  }
}
