import type { ShallowRef } from 'vue'
import { useSessionStorage } from '@vueuse/core'
import type { ResultOf, TadaDocumentNode } from 'gql.tada'
import { parse, print } from '@0no-co/graphql.web'
import { graphql } from '~/utils/graphql'
import {
  dateParam as isoDate,
  intParam as positiveInt,
  knownParams as known,
  listParam as list
} from '~/utils/urlQuery'
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
    shortlistedAt
    archivedAt
    analyzedAt
    status
    jobRole {
      name
    }
    seniority
    postingLanguage
    languages {
      language
      level
      isRequired
    }
  }
`)

export type ListingListItem = ResultOf<typeof LISTING_ITEM>

// Decide once on mount so pagination boundaries do not shift while browsing.
// Phones keep a small fixed page; larger screens fill the space below the results' actual top.
const PHONE_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 12
const MAX_TABLE_PAGE_SIZE = 24
const ROW_HEIGHT = 72
// The desktop table's title + company lines (40px) and vertical cell padding (32px).
// Keep this separate from mobile/tablet sizing even though both currently use 72px.
const TABLE_ROW_HEIGHT = 72
const RESERVED_BELOW = 72 // pager, its gap and the panel's bottom padding
const FILTER_WRAP_ALLOWANCE = 48

export const measurePageSize = (grid: HTMLElement, itemHeight?: number, gap = 0) => {
  if (!window.matchMedia('(min-width: 768px)').matches) return PHONE_PAGE_SIZE
  const tracks = (element: Element) => {
    const columns = getComputedStyle(element).gridTemplateColumns
    return !columns || columns === 'none' ? 1 : columns.trim().split(/\s+/).length
  }
  const layout = grid.closest('[data-testid="listings-columns"]')
  const sideBySide = !!layout && tracks(layout) > 1
  const table = grid.querySelector('table')
  // Filters can grow after counts arrive only when they sit above the results.
  const reserved = RESERVED_BELOW + (sideBySide ? 0 : FILTER_WRAP_ALLOWANCE)
  const headerHeight = table?.querySelector('thead')?.getBoundingClientRect().height ?? 0
  const available = window.innerHeight - grid.getBoundingClientRect().top - reserved - headerHeight
  const rowHeight = itemHeight ?? (table ? TABLE_ROW_HEIGHT : ROW_HEIGHT)
  const rows = Math.floor((available + gap) / (rowHeight + gap))
  return Math.min(Math.max(rows, 2) * tracks(grid), table ? MAX_TABLE_PAGE_SIZE : MAX_PAGE_SIZE)
}

// The query is built at runtime from fixed clause strings, not written as one literal graphql()
// document like everywhere else. A ListingFilterInput variable fails the API's cost check (HC0047:
// it prices every possible filter field), and a null, omitted or empty `in` filters instead of
// meaning "no filter". So a facet with nothing selected has to be left out of the query text.
// The clauses never contain user input; all values travel as variables.
// Typed like batchDocument: gql.tada can't infer a runtime document, so the result is named here.

const FILTER_KEYS = ['closingSoon', 'toAnalyze', 'withExpired', 'archived'] as const
export type ListingsFilter = (typeof FILTER_KEYS)[number]

export const LISTING_QUICK_PRESETS = [
  { value: 'itIdeal', label: 'IT Ideal' },
  { value: 'genericLocal', label: 'Generic Local' },
  { value: 'genericIdeal', label: 'Generic Ideal' },
  { value: 'remote', label: 'Remote' }
] as const
export type ListingQuickPreset = (typeof LISTING_QUICK_PRESETS)[number]['value']

export interface ListingsFacets {
  quickPreset: ListingQuickPreset | null
  favorites: boolean
  shortlist: boolean
  // In one of the profile's target locations (Location.isTarget).
  preferredLocations: boolean
  // Every location is in Norway; listings with an office abroad or no location drop out.
  norwayOnly: boolean
  // Rejected applications are hidden unless this is on (or statuses are picked).
  showRejected: boolean
  // Job role in the "IT" role category (the category belongs to the role, not the listing).
  itRoles: boolean
  // A known job role whose category isn't "IT"; listings without a role or category drop out.
  nonItRoles: boolean
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
  // One company's listings, set by the dashboard's favorite companies. No control in the sheet.
  companyId: number | null
}

export const DUE_WITHIN_OPTIONS = [3, 7, 14, 30] as const
const CLOSING_SOON_DAYS = 7

export const emptyFacets = (): ListingsFacets => ({
  quickPreset: null,
  favorites: false,
  shortlist: false,
  preferredLocations: false,
  norwayOnly: false,
  showRejected: false,
  itRoles: false,
  nonItRoles: false,
  englishPosting: false,
  englishMentioned: false,
  statuses: [],
  skills: [],
  locationIds: [],
  postingLanguages: [],
  languages: [],
  postedFrom: '',
  postedTo: '',
  dueWithinDays: null,
  companyId: null
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

export const pageFromQuery = (value: unknown) => {
  const page = Number(value)
  return Number.isInteger(page) && page > 1 ? page : 1
}

// The whole view lives in the URL, so back, refresh and links restore it. The dashboard links here
// with ?filter=<preset>, ?status=A,B, ?favorites=1 and ?company=<id>, the companies list with ?search=<name>.
// Unknown values are dropped, so a stale or hand-edited link still opens a sensible list.
export const parseListingsQuery = (query: Record<string, unknown>): ListingsView => {
  const languages = LANGUAGE_OPTIONS.map((o) => o.value)
  return {
    search: String(query.search ?? '').trim(),
    sort: known(LISTINGS_SORTS, query.sort)[0] ?? 'posted',
    filter: known(FILTER_KEYS, query.filter)[0] ?? null,
    facets: {
      quickPreset:
        known(
          LISTING_QUICK_PRESETS.map((p) => p.value),
          query.quick
        )[0] ?? null,
      favorites: query.favorites === '1',
      shortlist: query.shortlist === '1',
      preferredLocations: query.preferred === '1',
      norwayOnly: query.norway === '1',
      showRejected: query.rejected === '1',
      itRoles: query.it === '1',
      nonItRoles: query.nonIt === '1',
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
      dueWithinDays: Number(known(DUE_WITHIN_OPTIONS.map(String), query.due)[0]) || null,
      companyId: positiveInt(query.company)
    },
    page: pageFromQuery(query.page)
  }
}

// The inverse of parseListingsQuery. Defaults are left out, so the default view is a bare /listings.
export const toListingsQuery = ({ search, sort, filter, facets, page }: ListingsView) => {
  const query = {
    search,
    quick: facets.quickPreset ?? '',
    sort: sort === 'posted' ? '' : sort,
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
    shortlist: facets.shortlist ? '1' : '',
    preferred: facets.preferredLocations ? '1' : '',
    norway: facets.norwayOnly ? '1' : '',
    rejected: facets.showRejected ? '1' : '',
    it: facets.itRoles ? '1' : '',
    nonIt: facets.nonItRoles ? '1' : '',
    englishPosting: facets.englishPosting ? '1' : '',
    englishMentioned: facets.englishMentioned ? '1' : '',
    company: facets.companyId ? String(facets.companyId) : '',
    page: page > 1 ? String(page) : ''
  }
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value))
}

// The last /listings URL, so the listing page's Back returns to that view even after an edit.
// Session storage, not useState: a reload (F5, the update toast, or a Vite reload in dev) wipes
// in-memory state, and Back would land on the unfiltered list. Per tab, so tabs don't overwrite each
// other. The app is client-only, so reading storage during setup is safe.
export const useListingsView = () => useSessionStorage('listingsView', '/listings')
// Same for /companies, read by the company page's Back.
export const useCompaniesView = () => useState('companiesView', () => '/companies')
export const useContactsView = () => useState('contactsView', () => '/contacts')

type ListingsResult = {
  listings: { items: ListingListItem[]; totalCount: number } | null
} & Record<ListingsFilter | 'all' | QuickToggle, { totalCount: number } | null>

// Dated deadlines that have passed are filtered out; a listing stays visible through its deadline
// day. ASAP and UNSPECIFIED listings have no deadlineOn to filter on, so an "expired" one is
// flagged in ListingsDates instead of hidden.
const EXPIRY = 'or: [{ deadlineType: { neq: DATE } }, { deadlineOn: { gte: $today } }]'
// A rejected application is a closed door, so it stays out of every view and count by default.
const NOT_REJECTED = 'status: { neq: REJECTED }'

// `dueWithinDays: 7` is due within 7 days (today included), expired excluded, server-side.
// closingSoon's window is added in `field`, because the Due within facet can narrow it.
const PRESETS: Record<ListingsFilter | 'none', { args: string; where: string[] }> = {
  none: { args: '', where: [EXPIRY] },
  toAnalyze: { args: '', where: [EXPIRY, 'analyzedAt: { eq: null }'] },
  archived: { args: 'archived: true', where: [] },
  // Maintenance view: every non-archived listing, also those whose (possibly misparsed) deadline passed.
  withExpired: { args: '', where: [] },
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
  // `any: true` because `all` alone also matches a listing with no locations.
  norway: 'locations: { all: { location: { countryCode: { eq: "NO" } } }, any: true }',
  it: 'jobRole: { category: { name: { eq: "IT" } } }',
  // A listing with no role, or a role with no category, must not count as non-IT. The API rejects
  // `neq: null` (HC0026), so `gt: 0` (ids are positive) is the "has one" check.
  nonIt:
    'jobRoleId: { gt: 0 }, jobRole: { categoryId: { gt: 0 }, category: { name: { neq: "IT" } } }',
  englishPosting: 'postingLanguage: { eq: ENGLISH }',
  englishMentioned: 'languages: { some: { language: { eq: ENGLISH } } }'
} as const
export type QuickToggle = keyof typeof QUICK

const QUICK_PRESET_CLAUSES: Record<ListingQuickPreset, string[]> = {
  itIdeal: [QUICK.it, QUICK.norway, QUICK.preferred],
  genericLocal: [QUICK.nonIt, 'locations: { some: { location: { city: { eq: "Molde" } } } }'],
  genericIdeal: [QUICK.preferred, QUICK.nonIt],
  remote: ['locations: { all: { location: { countryCode: { neq: "NO" } } }, any: true }']
}

// No `order` for "due": the backend's default order is upcoming by due date, then expired by due
// date, then newest added, using the server-computed due date (DATE: deadlineOn, ASAP: postedOn + 14,
// UNSPECIFIED: postedOn + 30). dueOn itself isn't sortable, and any client `order` turns the default off,
// so due has no reverse. The `-asc`/`-desc` values come from the desktop table's column headers;
// "posted" stays the newest-first value so existing ?sort=posted links keep working.
const ORDERS = {
  due: undefined,
  posted: [{ postedOn: 'DESC' }],
  newest: [{ createdAt: 'DESC' }],
  changed: [{ statusChangedAt: 'DESC' }],
  'posted-asc': [{ postedOn: 'ASC' }],
  'title-asc': [{ title: 'ASC' }],
  'title-desc': [{ title: 'DESC' }],
  'seniority-asc': [{ seniority: 'ASC' }],
  'seniority-desc': [{ seniority: 'DESC' }],
  'status-asc': [{ status: 'ASC' }],
  'status-desc': [{ status: 'DESC' }]
} as const
export type ListingsSort = keyof typeof ORDERS
export const LISTINGS_SORTS = Object.keys(ORDERS) as ListingsSort[]

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
  if (facets.shortlist) facetClauses.push('shortlistedAt: { neq: null }')
  // Picking statuses (e.g. the dashboard's ?status=REJECTED) shows exactly those, like EXPIRY below.
  if (!facets.showRejected && !facets.statuses.length) facetClauses.push(NOT_REJECTED)
  if (facets.quickPreset) facetClauses.push(...QUICK_PRESET_CLAUSES[facets.quickPreset])
  if (facets.preferredLocations) facetClauses.push(QUICK.preferred)
  if (facets.norwayOnly) facetClauses.push(QUICK.norway)
  if (facets.itRoles) facetClauses.push(QUICK.it)
  if (facets.nonItRoles) facetClauses.push(QUICK.nonIt)
  if (facets.englishPosting) facetClauses.push(QUICK.englishPosting)
  if (facets.englishMentioned) facetClauses.push(QUICK.englishMentioned)
  const posted = [
    facets.postedFrom && 'gte: $postedFrom',
    facets.postedTo && 'lte: $postedTo'
  ].filter(Boolean)
  if (facets.companyId) {
    facetClauses.push('companyId: { eq: $companyId }')
    declarations.push('$companyId: Int!')
    variables.companyId = facets.companyId
  }
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
      withExpired: ${field('withExpired', ['take: 1', 'search: $search'], 'totalCount')}
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
  watch(
    search,
    useDebounce((value: string) => (settledSearch.value = value.trim()), 300)
  )
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
      withExpired: data.value?.withExpired?.totalCount ?? 0,
      archived: data.value?.archived?.totalCount ?? 0,
      preferred: data.value?.preferred?.totalCount ?? 0,
      norway: data.value?.norway?.totalCount ?? 0,
      it: data.value?.it?.totalCount ?? 0,
      nonIt: data.value?.nonIt?.totalCount ?? 0,
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
