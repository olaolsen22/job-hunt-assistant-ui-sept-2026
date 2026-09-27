import type { ResultOf } from 'gql.tada'

const LISTING_ITEM = graphql(`
  fragment ListingListItem on Listing {
    id
    title
    company {
      name
    }
    locations {
      location {
        city
        countryCode
      }
    }
    postedOn
    deadlineType
    deadlineOn
    url
    favoritedAt
    analyzedAt
    jobRole {
      name
    }
  }
`)

export type ListingListItem = ResultOf<typeof LISTING_ITEM>

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
// Filters are written into the query, not sent as a ListingFilterInput variable: the API can't
// see inside a filter variable, so its cost check prices every possible filter field and rejects it.
// That's also why there are two near-identical queries: gql.tada only types literal documents.
// `toAnalyze` only needs the count; take: 1 keeps its unused page minimal.
const LISTINGS = graphql(
  `
    query Listings($skip: Int, $take: Int, $today: LocalDate!) {
      listings(
        skip: $skip
        take: $take
        where: { or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }] }
      ) {
        items {
          ...ListingListItem
        }
        totalCount
      }
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
  `,
  [LISTING_ITEM]
)

const LISTINGS_TO_ANALYZE = graphql(
  `
    query ListingsToAnalyze($skip: Int, $take: Int, $today: LocalDate!) {
      listings(
        skip: $skip
        take: $take
        where: {
          or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }]
          analyzedAt: { eq: null }
        }
      ) {
        items {
          ...ListingListItem
        }
        totalCount
      }
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
  `,
  [LISTING_ITEM]
)

// Listings need the session cookie and change often; fetching client-only (server: false)
// avoids wiring cookie forwarding into the shared `gql` util for a single, non-SSR-critical page.
export const useListingsList = () => {
  const pageSize = getPageSize()
  const page = ref(1)
  const toAnalyzeOnly = ref(false)
  // A different filter has different pages.
  watch(toAnalyzeOnly, () => (page.value = 1))

  const { data, status, error, refresh } = useAsyncData(
    'listings',
    () =>
      gql(toAnalyzeOnly.value ? LISTINGS_TO_ANALYZE : LISTINGS, {
        skip: (page.value - 1) * pageSize,
        take: pageSize,
        // The user's local date, not UTC: the sv-SE locale formats as YYYY-MM-DD.
        today: new Date().toLocaleDateString('sv-SE')
      }),
    { watch: [page, toAnalyzeOnly], server: false }
  )

  return {
    listings: computed(() => data.value?.listings?.items ?? []),
    totalCount: computed(() => data.value?.listings?.totalCount ?? 0),
    toAnalyzeCount: computed(() => data.value?.toAnalyze?.totalCount ?? 0),
    page,
    pageSize,
    toAnalyzeOnly,
    loading: computed(() => status.value === 'pending'),
    error,
    refresh
  }
}
