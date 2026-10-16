import type { ShallowRef } from 'vue'
import type { ResultOf, TadaDocumentNode } from 'gql.tada'
import { parse, print } from '@0no-co/graphql.web'
import { graphql } from '~/utils/graphql'
import { APPLICATION_STATUS_OPTIONS, LANGUAGE_OPTIONS, type Language } from '~/constants/listing'

const LISTING_ITEM = graphql(`
  fragment ListingListItem on Listing {
    id
    title
    company {
      name
      avoidedAt
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
    archivedAt
    analyzedAt
    status
    jobRole {
      name
    }
    seniority
  }
`)

export type ListingListItem = ResultOf<typeof LISTING_ITEM>

// Page size is decided once per page load, not reactive to resize: changing it mid-pagination
// would shift page boundaries under the user. From `md` up it is how many rows fit between the
// grid's top and the bottom of the viewport, so the pager is visible without scrolling. Phones keep 5.
const PHONE_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 12
// Nominal listing row height (`md:min-h-16` plus a little slack); the rows sit flush, without a gap.
// If the pager ends up below the fold on a device, raise ROW_HEIGHT; if rows go unused, lower it.
const ROW_HEIGHT = 72
// Pager (~40) + the gap above it + the panel's bottom padding + the filter chips wrapping onto a second
// line once counts arrive (the grid is measured before any data exists).
const RESERVED_BELOW = 120

export const measurePageSize = (grid: HTMLElement, itemHeight = ROW_HEIGHT, gap = 0) => {
  if (!window.matchMedia('(min-width: 768px)').matches) return PHONE_PAGE_SIZE
  // Counting the resolved tracks keeps this independent of the grid's breakpoint classes.
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
  const available = window.innerHeight - grid.getBoundingClientRect().top - RESERVED_BELOW
  const rows = Math.floor((available + gap) / (itemHeight + gap))
  return Math.min(Math.max(rows, 2) * columns, MAX_PAGE_SIZE)
}

// The query is built at runtime from fixed clause strings, not written as one literal graphql()
// document like everywhere else. A ListingFilterInput variable fails the API's cost check (HC0047:
// it prices every possible filter field), and a null, omitted or empty `in` filters instead of
// meaning "no filter". So a facet with nothing selected has to be left out of the query text.
// The clauses never contain user input; all values travel as variables.
// Typed like batchDocument: gql.tada can't infer a runtime document, so the result is named here.

const FILTER_KEYS = ['closingSoon', 'toAnalyze', 'archived'] as const
export type ListingsFilter = (typeof FILTER_KEYS)[number]
const SORTS = ['due', 'newest', 'changed'] as const
export type ListingsSort = (typeof SORTS)[number]

export interface ListingsFacets {
  favorites: boolean
  // In one of the profile's target locations (Location.isTarget).
  preferredLocations: boolean
  // Job role in the "IT" role category (the category belongs to the role, not the listing).
  itRoles: boolean
  // The ad itself is written in English.
  englishPosting: boolean
  // The ad lists English among its languages, required or not.
  englishMentioned: boolean
  statuses: ListingListItem['status'][]
  skills: string[]
  locationIds: number[]
  postingLanguages: Language[]
  languages: Language[]
  // Posted-date range as YYYY-MM-DD, either end optional.
  postedFrom: string
  postedTo: string
  dueWithinDays: number | null
}

export const DUE_WITHIN_OPTIONS = [3, 7, 14, 30] as const
const CLOSING_SOON_DAYS = 7

export const emptyFacets = (): ListingsFacets => ({
  favorites: false,
  preferredLocations: false,
  itRoles: false,
  englishPosting: false,
  englishMentioned: false,
  statuses: [],
  skills: [],
  locationIds: [],
  postingLanguages: [],
  languages: [],
  postedFrom: '',
  postedTo: '',
  dueWithinDays: null
})

// Facets with something selected, not the number of selected values. The posted range is one facet.
export const countActiveFacets = ({ postedFrom, postedTo, ...rest }: ListingsFacets) =>
  Object.values(rest).filter((v) => (Array.isArray(v) ? v.length : v)).length +
  (postedFrom || postedTo ? 1 : 0)

export interface ListingsView {
  search: string
  sort: ListingsSort
  filter: ListingsFilter | null
  facets: ListingsFacets
  page: number
}

const list = (value: unknown) =>
  String(value ?? '')
    .split(',')
    .filter(Boolean)
const known = <T extends string>(values: readonly T[], value: unknown) =>
  list(value).filter((v): v is T => (values as readonly string[]).includes(v))

const isoDate = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : '')

export const pageFromQuery = (value: unknown) => {
  const page = Number(value)
  return Number.isInteger(page) && page > 1 ? page : 1
}

// The whole view lives in the URL, so back, refresh and links restore it. The dashboard links here
// with ?filter=<preset>, ?status=A,B and ?favorites=1, the companies list with ?search=<name>.
// Unknown values are dropped, so a stale or hand-edited link still opens a sensible list.
export const parseListingsQuery = (query: Record<string, unknown>): ListingsView => {
  const languages = LANGUAGE_OPTIONS.map((o) => o.value)
  return {
    search: String(query.search ?? '').trim(),
    sort: known(SORTS, query.sort)[0] ?? 'due',
    filter: known(FILTER_KEYS, query.filter)[0] ?? null,
    facets: {
      favorites: query.favorites === '1',
      preferredLocations: query.preferred === '1',
      itRoles: query.it === '1',
      englishPosting: query.englishPosting === '1',
      englishMentioned: query.englishMentioned === '1',
      statuses: known(
        APPLICATION_STATUS_OPTIONS.map((o) => o.value),
        query.status
      ),
      skills: list(query.skill),
      locationIds: list(query.location)
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
      postingLanguages: known(languages, query.postingLanguage),
      languages: known(languages, query.language),
      postedFrom: isoDate(query.postedFrom),
      postedTo: isoDate(query.postedTo),
      dueWithinDays: Number(known(DUE_WITHIN_OPTIONS.map(String), query.due)[0]) || null
    },
    page: pageFromQuery(query.page)
  }
}

// The inverse of parseListingsQuery. Defaults are left out, so the default view is a bare /listings.
export const toListingsQuery = ({ search, sort, filter, facets, page }: ListingsView) => {
  const query = {
    search,
    sort: sort === 'due' ? '' : sort,
    filter: filter ?? '',
    status: facets.statuses.join(','),
    skill: facets.skills.join(','),
    location: facets.locationIds.join(','),
    postingLanguage: facets.postingLanguages.join(','),
    language: facets.languages.join(','),
    postedFrom: facets.postedFrom,
    postedTo: facets.postedTo,
    due: facets.dueWithinDays ? String(facets.dueWithinDays) : '',
    favorites: facets.favorites ? '1' : '',
    preferred: facets.preferredLocations ? '1' : '',
    it: facets.itRoles ? '1' : '',
    englishPosting: facets.englishPosting ? '1' : '',
    englishMentioned: facets.englishMentioned ? '1' : '',
    page: page > 1 ? String(page) : ''
  }
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value))
}

// The last /listings URL, so the listing page's Back returns to that view even after an edit.
export const useListingsView = () => useState('listingsView', () => '/listings')
// Same for /companies, read by the company page's Back.
export const useCompaniesView = () => useState('companiesView', () => '/companies')

type ListingsResult = {
  listings: { items: ListingListItem[]; totalCount: number } | null
} & Record<ListingsFilter | 'all' | QuickToggle, { totalCount: number } | null>

// Dated deadlines that have passed are filtered out; a listing stays visible through its deadline
// day. ASAP and UNSPECIFIED listings have no deadlineOn to filter on, so an "expired" one is
// flagged in ListingsDates instead of hidden.
const EXPIRY = 'or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }]'

// `dueWithinDays: 7` is due within 7 days (today included), expired excluded, server-side.
// closingSoon's window is added in `field`, because the Due within facet can narrow it.
const PRESETS: Record<ListingsFilter | 'none', { args: string; where: string[] }> = {
  none: { args: '', where: [EXPIRY] },
  toAnalyze: { args: '', where: [EXPIRY, 'analyzedAt: { eq: null }'] },
  archived: { args: 'archived: true', where: [] },
  closingSoon: { args: '', where: [] }
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

// Quick toggles beside the presets. Each is a facet clause with its own count under the active
// preset and facets. IT matches the role category by name, so no id lookup is needed first; a
// renamed category just counts 0 and the toggle hides.
const QUICK = {
  preferred: 'locations: { some: { location: { isTarget: { eq: true } } } }',
  it: 'jobRole: { category: { name: { eq: "IT" } } }',
  englishPosting: 'postingLanguage: { eq: ENGLISH }',
  englishMentioned: 'languages: { some: { language: { eq: ENGLISH } } }'
} as const
export type QuickToggle = keyof typeof QUICK

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
  if (facets.preferredLocations) facetClauses.push(QUICK.preferred)
  if (facets.itRoles) facetClauses.push(QUICK.it)
  if (facets.englishPosting) facetClauses.push(QUICK.englishPosting)
  if (facets.englishMentioned) facetClauses.push(QUICK.englishMentioned)
  const posted = [
    facets.postedFrom && 'gte: $postedFrom',
    facets.postedTo && 'lte: $postedTo'
  ].filter(Boolean)
  if (posted.length) facetClauses.push(`postedOn: { ${posted.join(', ')} }`)
  if (facets.postedFrom) {
    declarations.push('$postedFrom: LocalDate!')
    variables.postedFrom = facets.postedFrom
  }
  if (facets.postedTo) {
    declarations.push('$postedTo: LocalDate!')
    variables.postedTo = facets.postedTo
  }
  for (const key of Object.keys(FACETS) as (keyof typeof FACETS)[]) {
    if (!facets[key].length) continue
    facetClauses.push(FACETS[key].clause)
    declarations.push(`$${key}: ${FACETS[key].type}`)
    variables[key] = facets[key]
  }
  // Picking statuses is asking for those applications, so they stay visible past their deadline.
  const withExpiry = !facets.statuses.length

  const field = (
    preset: ListingsFilter | 'none',
    args: string[],
    selection: string,
    extra: string[] = []
  ) => {
    const { args: presetArgs, where } = PRESETS[preset]
    const clauses = [
      ...new Set([...where.filter((c) => withExpiry || c !== EXPIRY), ...facetClauses, ...extra])
    ]
    // Both windows start today, so with closing soon active the narrower one is the intersection.
    const days =
      preset === 'closingSoon'
        ? Math.min(CLOSING_SOON_DAYS, facets.dueWithinDays ?? CLOSING_SOON_DAYS)
        : facets.dueWithinDays
    const all = [
      ...args,
      presetArgs,
      days ? `dueWithinDays: ${days}` : '',
      clauses.length ? `where: { and: [{ ${clauses.join(' }, { ')} }] }` : ''
    ]
    return `listings(${all.filter(Boolean).join(', ')}) { ${selection} }`
  }

  const quickCounts = (Object.keys(QUICK) as QuickToggle[])
    .map((key) => {
      const counted = field(filter ?? 'none', ['take: 1', 'search: $search'], 'totalCount', [
        QUICK[key]
      ])
      return `${key}: ${counted}`
    })
    .join('\n')

  const text = `
    query Listings(%DECLARATIONS%) {
      ${field(filter ?? 'none', ['skip: $skip', 'take: $take', 'search: $search', 'order: $order'], 'items { ...ListingListItem } totalCount')}
      all: ${field('none', ['take: 1', 'search: $search'], 'totalCount')}
      toAnalyze: ${field('toAnalyze', ['take: 1', 'search: $search'], 'totalCount')}
      archived: ${field('archived', ['take: 1', 'search: $search'], 'totalCount')}
      closingSoon: ${field('closingSoon', ['take: 1', 'search: $search'], 'totalCount')}
      ${quickCounts}
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
  const route = useRoute()
  const router = useRouter()
  const initial = parseListingsQuery(route.query)
  const page = ref(initial.page)
  const filter = ref<ListingsFilter | null>(initial.filter)
  const search = ref(initial.search)
  // Typing shouldn't refetch on every keystroke, so the query only sees the settled value.
  const settledSearch = ref(initial.search)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(search, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => (settledSearch.value = value.trim()), 300)
  })
  const sort = ref<ListingsSort>(initial.sort)
  const facets = reactive(initial.facets)
  // A different filter, search, sort or facet has different pages. Watchers don't fire for the
  // initial values, so a page restored from the URL survives.
  watch([filter, settledSearch, sort, facets], () => (page.value = 1))

  // `replace`, not `push`: filter tweaks aren't history entries, so browser back leaves the page.
  // A query-only change doesn't remount the page, so it never re-reads its own writes.
  const lastView = useListingsView()
  lastView.value = route.fullPath
  watch([page, filter, settledSearch, sort, facets], () => {
    const to = router.resolve({
      path: route.path,
      query: toListingsQuery({
        search: settledSearch.value,
        sort: sort.value,
        filter: filter.value,
        facets,
        page: page.value
      })
    })
    lastView.value = to.fullPath
    router.replace(to)
  })

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

  // A page restored from the URL can be past the end (another screen size, listings archived since),
  // which would show an empty list with no pager to get back.
  watch(data, () => {
    const last = Math.max(1, Math.ceil((data.value?.listings?.totalCount ?? 0) / pageSize.value))
    if (page.value > last) page.value = last
  })

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
      all: data.value?.all?.totalCount ?? 0,
      closingSoon: data.value?.closingSoon?.totalCount ?? 0,
      toAnalyze: data.value?.toAnalyze?.totalCount ?? 0,
      archived: data.value?.archived?.totalCount ?? 0,
      preferred: data.value?.preferred?.totalCount ?? 0,
      it: data.value?.it?.totalCount ?? 0,
      englishPosting: data.value?.englishPosting?.totalCount ?? 0,
      englishMentioned: data.value?.englishMentioned?.totalCount ?? 0
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
