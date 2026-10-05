import type { ShallowRef } from 'vue'
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
    dueOn
    url
    favoritedAt
    analyzedAt
    status
    jobRole {
      name
    }
  }
`)

export type ListingListItem = ResultOf<typeof LISTING_ITEM>

// Page size is decided once per page load, not reactive to resize: changing it mid-pagination
// would shift page boundaries under the user. From `md` up it is how many cards fit between the
// grid's top and the bottom of the viewport, so the pager is visible without scrolling. Phones keep 5.
const PHONE_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 12
// Nominal card height (one-line title) plus a little slack, and the grid's `gap-4`. If the pager
// ends up below the fold on a device, raise CARD_HEIGHT; if rows go unused, lower it.
const CARD_HEIGHT = 168
const GRID_GAP = 16
// Pager (~40) + the gap above it + the panel's bottom padding + the filter chips wrapping onto a second
// line once counts arrive (the grid is measured before any data exists).
const RESERVED_BELOW = 120

export const measurePageSize = (grid: HTMLElement) => {
  if (!window.matchMedia('(min-width: 768px)').matches) return PHONE_PAGE_SIZE
  // Counting the resolved tracks keeps this independent of the grid's breakpoint classes.
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
  const available = window.innerHeight - grid.getBoundingClientRect().top - RESERVED_BELOW
  const rows = Math.floor((available + GRID_GAP) / (CARD_HEIGHT + GRID_GAP))
  return Math.min(Math.max(rows, 2) * columns, MAX_PAGE_SIZE)
}

// No `order` argument: the backend's default order is upcoming by due date, then expired by due
// date, then newest added. The due date is server-computed (DATE: deadlineOn, ASAP: postedOn + 14,
// UNSPECIFIED: postedOn + 30). Sending our own order (e.g. by deadlineType or deadlineOn) would
// sort those raw columns instead, which is wrong: deadlineType is stored as a string and
// deadlineOn puts nulls first.
// Dated deadlines that have passed are still filtered out server-side; a listing stays visible
// through its deadline day. ASAP and UNSPECIFIED listings have no deadlineOn to filter on, so an
// "expired" one is flagged in ListingsDates instead of hidden.
// Filters are written into the query, not sent as a ListingFilterInput variable: the API can't
// see inside a filter variable, so its cost check prices every possible filter field and rejects it.
// That's also why there is one near-identical query per filter: gql.tada only types literal documents.
// The counts only feed the filter buttons; take: 1 keeps their unused pages minimal.
const LISTING_COUNTS = graphql(`
  fragment ListingCounts on Query {
    toAnalyze: listings(
      take: 1
      search: $search
      where: {
        or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }]
        analyzedAt: { eq: null }
      }
    ) {
      totalCount
    }
    active: listings(take: 1, search: $search, where: { status: { in: [APPLIED, INTERVIEWING] } }) {
      totalCount
    }
    archived: listings(take: 1, archived: true, search: $search) {
      totalCount
    }
    closingSoon: listings(take: 1, dueWithinDays: 7, search: $search) {
      totalCount
    }
  }
`)

const LISTINGS = graphql(
  `
    query Listings($skip: Int, $take: Int, $today: LocalDate!, $search: String) {
      listings(
        skip: $skip
        take: $take
        search: $search
        where: { or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }] }
      ) {
        items {
          ...ListingListItem
        }
        totalCount
      }
      ...ListingCounts
    }
  `,
  [LISTING_ITEM, LISTING_COUNTS]
)

const LISTINGS_TO_ANALYZE = graphql(
  `
    query ListingsToAnalyze($skip: Int, $take: Int, $today: LocalDate!, $search: String) {
      listings(
        skip: $skip
        take: $take
        search: $search
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
      ...ListingCounts
    }
  `,
  [LISTING_ITEM, LISTING_COUNTS]
)

// Active applications stay visible past their deadline, newest activity first.
const LISTINGS_ACTIVE = graphql(
  `
    query ListingsActive($skip: Int, $take: Int, $today: LocalDate!, $search: String) {
      listings(
        skip: $skip
        take: $take
        search: $search
        where: { status: { in: [APPLIED, INTERVIEWING] } }
        order: { statusChangedAt: DESC }
      ) {
        items {
          ...ListingListItem
        }
        totalCount
      }
      ...ListingCounts
    }
  `,
  [LISTING_ITEM, LISTING_COUNTS]
)

const LISTINGS_ARCHIVED = graphql(
  `
    query ListingsArchived($skip: Int, $take: Int, $today: LocalDate!, $search: String) {
      listings(skip: $skip, take: $take, archived: true, search: $search) {
        items {
          ...ListingListItem
        }
        totalCount
      }
      ...ListingCounts
    }
  `,
  [LISTING_ITEM, LISTING_COUNTS]
)

// Due within 7 days (today included), in the server's default order.
const LISTINGS_CLOSING_SOON = graphql(
  `
    query ListingsClosingSoon($skip: Int, $take: Int, $today: LocalDate!, $search: String) {
      listings(skip: $skip, take: $take, dueWithinDays: 7, search: $search) {
        items {
          ...ListingListItem
        }
        totalCount
      }
      ...ListingCounts
    }
  `,
  [LISTING_ITEM, LISTING_COUNTS]
)

const QUERIES = {
  closingSoon: LISTINGS_CLOSING_SOON,
  toAnalyze: LISTINGS_TO_ANALYZE,
  active: LISTINGS_ACTIVE,
  archived: LISTINGS_ARCHIVED
}

export type ListingsFilter = keyof typeof QUERIES

// Listings need the session cookie and change often; fetching client-only (server: false)
// avoids wiring cookie forwarding into the shared `gql` util for a single, non-SSR-critical page.
export const useListingsList = (grid: Readonly<ShallowRef<HTMLElement | null>>) => {
  const pageSize = ref(PHONE_PAGE_SIZE)
  const page = ref(1)
  const filter = ref<ListingsFilter | null>(null)
  const search = ref('')
  // Typing shouldn't refetch on every keystroke, so the query only sees the settled value.
  const settledSearch = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(search, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => (settledSearch.value = value.trim()), 300)
  })
  // A different filter or search has different pages.
  watch([filter, settledSearch], () => (page.value = 1))

  const { data, status, error, refresh, execute } = useAsyncData(
    'listings',
    () =>
      gql(filter.value ? QUERIES[filter.value] : LISTINGS, {
        skip: (page.value - 1) * pageSize.value,
        take: pageSize.value,
        // The user's local date, not UTC: the sv-SE locale formats as YYYY-MM-DD.
        today: new Date().toLocaleDateString('sv-SE'),
        search: settledSearch.value || null
      }),
    { watch: [page, filter, settledSearch], server: false, immediate: false }
  )

  // The grid has to be in the DOM to be measured, so the one and only first fetch waits for mount
  // (like measuring in Vue 2's `mounted()` before kicking off the request).
  onMounted(() => {
    pageSize.value = measurePageSize(grid.value!)
    execute()
  })

  return {
    listings: computed(() => data.value?.listings?.items ?? []),
    totalCount: computed(() => data.value?.listings?.totalCount ?? 0),
    counts: computed(() => ({
      closingSoon: data.value?.closingSoon?.totalCount ?? 0,
      toAnalyze: data.value?.toAnalyze?.totalCount ?? 0,
      active: data.value?.active?.totalCount ?? 0,
      archived: data.value?.archived?.totalCount ?? 0
    })),
    page,
    pageSize,
    filter,
    search,
    // `idle` is the moment before the first fetch starts, which should look like loading, not empty.
    loading: computed(() => status.value === 'pending' || status.value === 'idle'),
    error,
    refresh
  }
}
