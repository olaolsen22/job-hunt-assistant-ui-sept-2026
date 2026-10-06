import type { ShallowRef } from 'vue'
import type { ResultOf, TadaDocumentNode } from 'gql.tada'
import { parse, print } from '@0no-co/graphql.web'
import type { Language } from '~/constants/listing'

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

export const measurePageSize = (grid: HTMLElement, cardHeight = CARD_HEIGHT, gap = GRID_GAP) => {
  if (!window.matchMedia('(min-width: 768px)').matches) return PHONE_PAGE_SIZE
  // Counting the resolved tracks keeps this independent of the grid's breakpoint classes.
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
  const available = window.innerHeight - grid.getBoundingClientRect().top - RESERVED_BELOW
  const rows = Math.floor((available + gap) / (cardHeight + gap))
  return Math.min(Math.max(rows, 2) * columns, MAX_PAGE_SIZE)
}

// The query is built at runtime from fixed clause strings, not written as one literal graphql()
// document like everywhere else. A ListingFilterInput variable fails the API's cost check (HC0047:
// it prices every possible filter field), and a null, omitted or empty `in` filters instead of
// meaning "no filter". So a facet with nothing selected has to be left out of the query text.
// The clauses never contain user input; all values travel as variables.
// Typed like batchDocument: gql.tada can't infer a runtime document, so the result is named here.

export type ListingsFilter = 'closingSoon' | 'toAnalyze' | 'archived'
export type ListingsSort = 'due' | 'newest' | 'changed'

export interface ListingsFacets {
  favorites: boolean
  statuses: ListingListItem['status'][]
  skills: string[]
  locationIds: number[]
  postingLanguages: Language[]
  languages: Language[]
}

export const emptyFacets = (): ListingsFacets => ({
  favorites: false,
  statuses: [],
  skills: [],
  locationIds: [],
  postingLanguages: [],
  languages: []
})

// Facets with something selected, not the number of selected values.
export const countActiveFacets = (facets: ListingsFacets) =>
  Object.values(facets).filter((v) => (Array.isArray(v) ? v.length : v)).length

type ListingsResult = {
  listings: { items: ListingListItem[]; totalCount: number } | null
} & Record<ListingsFilter, { totalCount: number } | null>

// Dated deadlines that have passed are filtered out; a listing stays visible through its deadline
// day. ASAP and UNSPECIFIED listings have no deadlineOn to filter on, so an "expired" one is
// flagged in ListingsDates instead of hidden.
const EXPIRY = 'or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }]'

// `dueWithinDays: 7` is due within 7 days (today included), expired excluded, server-side.
const PRESETS: Record<ListingsFilter | 'none', { args: string; where: string[] }> = {
  none: { args: '', where: [EXPIRY] },
  toAnalyze: { args: '', where: [EXPIRY, 'analyzedAt: { eq: null }'] },
  archived: { args: 'archived: true', where: [] },
  closingSoon: { args: 'dueWithinDays: 7', where: [] }
}

const FACETS = {
  statuses: { clause: 'status: { in: $statuses }', type: '[ApplicationStatus!]!' },
  skills: { clause: 'skills: { some: { skill: { name: { in: $skills } } } }', type: '[String!]!' },
  locationIds: {
    clause: 'locations: { some: { locationId: { in: $locationIds } } }',
    type: '[Int!]!'
  },
  postingLanguages: { clause: 'postingLanguage: { in: $postingLanguages }', type: '[Language!]!' },
  languages: {
    clause: 'languages: { some: { language: { in: $languages } } }',
    type: '[Language!]!'
  }
} as const

// No `order` for "due": the backend's default order is upcoming by due date, then expired by due
// date, then newest added, using the server-computed due date (DATE: deadlineOn, ASAP: postedOn + 14,
// UNSPECIFIED: postedOn + 30). dueOn itself isn't sortable, and any client `order` turns the default off.
const ORDERS = {
  due: undefined,
  newest: [{ createdAt: 'DESC' }],
  changed: [{ statusChangedAt: 'DESC' }]
} as const

export const buildListingsQuery = (
  filter: ListingsFilter | null,
  facets: ListingsFacets,
  sort: ListingsSort
) => {
  const declarations = [
    '$skip: Int',
    '$take: Int',
    '$search: String',
    '$order: [ListingSortInput!]'
  ]
  const variables: Record<string, unknown> = { order: ORDERS[sort] }
  const facetClauses = facets.favorites ? ['favoritedAt: { neq: null }'] : []
  for (const key of Object.keys(FACETS) as (keyof typeof FACETS)[]) {
    if (!facets[key].length) continue
    facetClauses.push(FACETS[key].clause)
    declarations.push(`$${key}: ${FACETS[key].type}`)
    variables[key] = facets[key]
  }
  // Picking statuses is asking for those applications, so they stay visible past their deadline.
  const withExpiry = !facets.statuses.length

  const field = (preset: ListingsFilter | 'none', args: string[], selection: string) => {
    const { args: presetArgs, where } = PRESETS[preset]
    const clauses = [...where.filter((c) => withExpiry || c !== EXPIRY), ...facetClauses]
    const all = [
      ...args,
      presetArgs,
      clauses.length ? `where: { and: [{ ${clauses.join(' }, { ')} }] }` : ''
    ]
    return `listings(${all.filter(Boolean).join(', ')}) { ${selection} }`
  }

  const text = `
    query Listings(%DECLARATIONS%) {
      ${field(filter ?? 'none', ['skip: $skip', 'take: $take', 'search: $search', 'order: $order'], 'items { ...ListingListItem } totalCount')}
      toAnalyze: ${field('toAnalyze', ['take: 1', 'search: $search'], 'totalCount')}
      archived: ${field('archived', ['take: 1', 'search: $search'], 'totalCount')}
      closingSoon: ${field('closingSoon', ['take: 1', 'search: $search'], 'totalCount')}
    }
    ${print(LISTING_ITEM)}
  `
  if (text.includes('$today')) {
    declarations.push('$today: LocalDate!')
    // The user's local date, not UTC: the sv-SE locale formats as YYYY-MM-DD.
    variables.today = new Date().toLocaleDateString('sv-SE')
  }
  return {
    document: parse(text.replace('%DECLARATIONS%', declarations.join(', '))) as TadaDocumentNode<
      ListingsResult,
      Record<string, unknown>
    >,
    variables
  }
}

// Listings need the session cookie and change often; fetching client-only (server: false)
// avoids wiring cookie forwarding into the shared `gql` util for a single, non-SSR-critical page.
export const useListingsList = (grid: Readonly<ShallowRef<HTMLElement | null>>) => {
  const pageSize = ref(PHONE_PAGE_SIZE)
  const page = ref(1)
  const filter = ref<ListingsFilter | null>(null)
  // The companies list links here with ?search=<name>.
  const initialSearch = String(useRoute().query.search ?? '').trim()
  const search = ref(initialSearch)
  // Typing shouldn't refetch on every keystroke, so the query only sees the settled value.
  const settledSearch = ref(initialSearch)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(search, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => (settledSearch.value = value.trim()), 300)
  })
  const sort = ref<ListingsSort>('due')
  const facets = reactive(emptyFacets())
  // A different filter, search, sort or facet has different pages.
  watch([filter, settledSearch, sort, facets], () => (page.value = 1))

  const { data, status, error, refresh, execute } = useAsyncData(
    'listings',
    () => {
      const { document, variables } = buildListingsQuery(filter.value, facets, sort.value)
      return gql(document, {
        ...variables,
        skip: (page.value - 1) * pageSize.value,
        take: pageSize.value,
        search: settledSearch.value || null
      })
    },
    { watch: [page, filter, settledSearch, sort, facets], server: false, immediate: false }
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
      archived: data.value?.archived?.totalCount ?? 0
    })),
    page,
    pageSize,
    filter,
    search,
    sort,
    facets,
    // `idle` is the moment before the first fetch starts, which should look like loading, not empty.
    loading: computed(() => status.value === 'pending' || status.value === 'idle'),
    error,
    refresh
  }
}
