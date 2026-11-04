import type { ShallowRef } from 'vue'
import type { CompaniesSort, CompaniesTab } from '~/constants/company'
import { measurePageSize, useCompaniesView } from '~/composables/useListingsList'

// The /companies view: search, type tab, sort and facets, all kept in the URL like /listings so
// coming back from a company restores them, over numbered cursor pages.
export const useCompaniesList = (grid: Readonly<ShallowRef<HTMLElement | null>>) => {
  const route = useRoute()
  const router = useRouter()
  const initial = parseCompaniesQuery(route.query)
  const search = ref(initial.search)
  // Typing shouldn't refetch on every keystroke, so the query only sees the settled value.
  const settledSearch = ref(initial.search)
  const tab = ref<CompaniesTab>(initial.tab)
  const sort = ref<CompaniesSort>(initial.sort)
  const facets = reactive(initial.facets)
  // Same rule as /listings (5 on phones, otherwise what fits the screen, max 12), measured on mount.
  const pageSize = ref(5)
  const { page, after, walking, reset, remember, goTo: walkTo } = useCursorPages()

  watch(
    search,
    useDebounce((value: string) => {
      // A trailing space isn't a new search, so it keeps the page.
      if (value.trim() === settledSearch.value) return
      settledSearch.value = value.trim()
      reset()
    }, 300)
  )
  watch([tab, sort, facets], reset)

  // `replace`: paging and filtering aren't history entries, so browser back leaves the page.
  // The company page's Back returns to the last of these URLs.
  const lastView = useCompaniesView()
  lastView.value = route.fullPath
  watch([page, settledSearch, tab, sort, facets], () => {
    const to = router.resolve({
      path: route.path,
      query: toCompaniesQuery({
        search: settledSearch.value,
        tab: tab.value,
        sort: sort.value,
        facets,
        page: page.value
      })
    })
    lastView.value = to.fullPath
    router.replace(to)
  })

  const fetchPage = (cursor: string | null) => {
    const { document, variables } = buildCompaniesQuery(
      { tab: tab.value, sort: sort.value, facets },
      pageSize.value
    )
    return gql(document, { ...variables, search: settledSearch.value || null, after: cursor })
  }

  // Needs the session cookie, so fetched client-only like the listings list.
  const { data, status, error, execute } = useAsyncData('companies', () => fetchPage(after.value), {
    watch: [page, settledSearch, tab, sort, facets],
    server: false,
    immediate: false
  })

  const goTo = (target: number) =>
    walkTo(target, async (cursor) => (await fetchPage(cursor)).companies!.pageInfo)

  // The grid has to be in the DOM to be measured, so the first fetch waits for mount. Row heights
  // are the rendered ones: one line from `lg` up, stacked below.
  onMounted(async () => {
    const rowHeight = window.matchMedia('(min-width: 1024px)').matches ? 72 : 132
    pageSize.value = measurePageSize(grid.value!, rowHeight, 12)
    // A restored page is fetched by the page watcher; page 1 (also a restored page clamped to it)
    // isn't.
    // If the walk fails, a page above 1 is fetched by the page watcher, which then shows the error.
    try {
      if (initial.page > 1) await goTo(initial.page)
    } finally {
      if (page.value === 1) execute()
    }
  })

  watch(data, () => remember(data.value?.companies?.pageInfo))

  return {
    search,
    settledSearch,
    tab,
    sort,
    facets,
    page,
    pageSize,
    companies: computed(() => data.value?.companies?.nodes ?? []),
    totalCount: computed(() => data.value?.companies?.totalCount ?? 0),
    loading: computed(() => walking.value || status.value === 'pending' || status.value === 'idle'),
    error,
    goTo,
    // Search too, settled at once: waiting for the debounce would fetch twice and keep "No match".
    clearAll: () => {
      search.value = ''
      settledSearch.value = ''
      Object.assign(facets, emptyCompaniesFacets())
      reset()
    }
  }
}
