import type { DeadlineType } from '~/constants/listing'

export interface ListingListItem {
  id: number
  title: string
  company: { name: string }
  locations: { location: { city: string | null; countryCode: string } }[]
  postedOn: string
  deadlineType: DeadlineType
  deadlineOn: string | null
  url: string
  favoritedAt: string | null
  analyzedAt: string | null
  jobRole: { name: string }
}

interface ListingsResult {
  listings: {
    items: ListingListItem[] | null
    totalCount: number
  }
  toAnalyze: { totalCount: number }
}

// Page size is decided once per page load, not reactive to resize: changing it mid-pagination
// would shift page boundaries under the user. Below `lg` the grid is a single column, so fewer rows fit
// on a phone screen; at `lg`+ (two columns) the row count is picked from viewport height so the
// list roughly fills common desktop heights (1440p/1080p/laptop) without a card-height formula.
const getPageSize = () => {
  if (!import.meta.client) return 5
  if (!window.matchMedia('(min-width: 1024px)').matches) return 5
  if (window.innerHeight >= 1200) return 10 // 5 rows x 2 cols, e.g. 1440p
  if (window.innerHeight >= 900) return 8 // 4 rows x 2 cols, e.g. 1080p
  return 6 // 3 rows x 2 cols
}

// No `order` argument: the backend's default order is closest deadline first (ASAP counts as
// due 14 days after postedOn), then rolling/unspecified newest first, then expired last. Sending
// our own order (e.g. by deadlineType or deadlineOn) would sort those raw columns instead, which
// is wrong: deadlineType is stored as a string and deadlineOn puts nulls first.
// Dated deadlines that have passed are still filtered out server-side; a listing stays visible
// through its deadline day. ASAP listings have no deadlineOn to filter on, so an "expired" one
// (posted 14+ days ago) is flagged in ListingsDates instead of hidden.
const LISTINGS_QUERY = `
  query Listings($skip: Int, $take: Int, $today: LocalDate!) {
    listings(
      skip: $skip
      take: $take
      where: { or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }] }
    ) {
      items {
        id
        title
        company { name }
        locations { location { city countryCode } }
        postedOn
        deadlineType
        deadlineOn
        url
        favoritedAt
        analyzedAt
        jobRole { name }
      }
      totalCount
    }
    # Only the count is needed; take: 1 keeps the unused page minimal.
    toAnalyze: listings(
      take: 1
      where: {
        or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }]
        analyzedAt: { eq: null }
      }
    ) {
      totalCount
    }
  }
`

// Listings need the session cookie and change often; fetching client-only (server: false)
// avoids wiring cookie forwarding into the shared `gql` util for a single, non-SSR-critical page.
export const useListingsList = () => {
  const pageSize = getPageSize()
  const page = ref(1)

  const { data, status, error, refresh } = useAsyncData(
    'listings',
    () =>
      gql<ListingsResult>(LISTINGS_QUERY, {
        skip: (page.value - 1) * pageSize,
        take: pageSize,
        // The user's local date, not UTC: the sv-SE locale formats as YYYY-MM-DD.
        today: new Date().toLocaleDateString('sv-SE')
      }),
    { watch: [page], server: false }
  )

  return {
    listings: computed(() => data.value?.listings.items ?? []),
    totalCount: computed(() => data.value?.listings.totalCount ?? 0),
    toAnalyzeCount: computed(() => data.value?.toAnalyze.totalCount ?? 0),
    page,
    pageSize,
    loading: computed(() => status.value === 'pending'),
    error,
    refresh
  }
}
