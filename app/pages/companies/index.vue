<script setup lang="ts">
import { parse, print } from '@0no-co/graphql.web'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { measurePageSize } from '~/composables/useListingsList'

definePageMeta({ title: 'Companies' })

// `first: 20` is a placeholder: the page size is measured at runtime and has to be a literal in the
// query text, because the API's cost check prices any `first` variable as 50 (HC0047).
const COMPANIES = graphql(`
  query Companies($search: String, $after: String) {
    companies(search: $search, first: 20, after: $after, order: { name: ASC }) {
      nodes {
        id
        name
        listingCount
        applicationCount
        industry {
          name
        }
        locations {
          location {
            city
            countryCode
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`)

const search = ref('')
// Typing shouldn't refetch on every keystroke, so the query only sees the settled value.
const settledSearch = ref('')
const grid = useTemplateRef('grid')
// Same rule as /listings (5 on phones, otherwise what fits the screen, max 12), measured once on mount.
const pageSize = ref(5)
const companiesQuery = () =>
  parse(print(COMPANIES).replace('first: 20', `first: ${pageSize.value}`)) as typeof COMPANIES
const page = ref(1)
// `cursors[p - 1]` is the `after` cursor of page p. The API only pages by cursor (no skip), so
// numbered pages are possible only for pages whose cursor we already know.
const cursors = ref<(string | null)[]>([null])
const walking = ref(false)
const after = computed(() => cursors.value[page.value - 1] ?? null)

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    settledSearch.value = value.trim()
    // Reset in the same tick, or the refetch would pair the new search with an old cursor.
    cursors.value = [null]
    page.value = 1
  }, 300)
})

// Needs the session cookie, so fetched client-only like the listings list.
const { data, status, error, execute } = useAsyncData(
  'companies',
  () => gql(companiesQuery(), { search: settledSearch.value || null, after: after.value }),
  { watch: [page, settledSearch], server: false, immediate: false }
)

// The grid has to be in the DOM to be measured, so the first fetch waits for mount. Row heights are
// the rendered ones: one line from `lg` up, stacked below (CSS can't be read before rows exist).
onMounted(() => {
  const rowHeight = window.matchMedia('(min-width: 1024px)').matches ? 72 : 132
  pageSize.value = measurePageSize(grid.value!, rowHeight, 12)
  execute()
})

const companies = computed(() => data.value?.companies?.nodes ?? [])
const totalCount = computed(() => data.value?.companies?.totalCount ?? 0)
const pageInfo = computed(() => data.value?.companies?.pageInfo)
const loading = computed(
  () => walking.value || status.value === 'pending' || status.value === 'idle'
)

// Remembers where the next page starts, so Next and later numbered clicks need no extra requests.
watch(data, () => {
  if (pageInfo.value?.hasNextPage) cursors.value[page.value] = pageInfo.value.endCursor!
})

// Jumping past the known cursors walks forward one page at a time (`first` is capped at 50 server-side,
// so loading N pages in one request is not possible).
const goTo = async (target: number) => {
  walking.value = true
  while (cursors.value.length < target) {
    const res = await gql(companiesQuery(), {
      search: settledSearch.value || null,
      after: cursors.value.at(-1) ?? null
    })
    cursors.value.push(res.companies!.pageInfo.endCursor!)
  }
  walking.value = false
  page.value = target
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const places = (c: (typeof companies.value)[number]) =>
  c.locations
    .map(({ location: l }) => (l.city ? `${l.city}, ${l.countryCode}` : l.countryCode))
    .join(' · ')
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <!-- Kept visible while loading, so it doesn't pop in after the first fetch. -->
      <UInput
        v-if="loading || companies.length || search"
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search companies"
        class="w-full sm:max-w-sm"
        data-testid="companies-search"
      >
        <template v-if="search" #trailing>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            data-testid="companies-search-clear"
            @click="search = ''"
          />
        </template>
      </UInput>
      <UButton
        to="/companies/add"
        icon="i-lucide-plus"
        class="justify-center sm:ml-auto"
        data-testid="companies-add"
      >
        Add companies
      </UButton>
    </div>

    <p
      v-if="companies.length || search"
      class="text-lg font-semibold text-highlighted"
      data-testid="companies-total"
    >
      {{ totalCount }} {{ totalCount === 1 ? 'company' : 'companies' }}
    </p>

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div
      v-else-if="!loading && companies.length === 0"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="companies-empty"
    >
      <UIcon name="i-lucide-building-2" class="size-10 text-muted" />
      <p>{{ search ? 'No companies match.' : 'No companies yet.' }}</p>
      <UButton v-if="!search" to="/companies/add">Add companies</UButton>
    </div>

    <template v-else>
      <div ref="grid" class="grid gap-3" data-testid="companies-list">
        <template v-if="loading && companies.length === 0">
          <USkeleton v-for="i in pageSize" :key="i" class="h-20 w-full lg:h-16" />
        </template>
        <NuxtLink
          v-for="c in companies"
          v-else
          :key="c.id"
          :to="{ path: '/listings', query: { search: c.name } }"
          class="block"
        >
          <UCard class="transition hover:bg-elevated" data-testid="companies-row">
            <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-6">
              <div class="min-w-0 lg:flex-1">
                <p class="truncate font-medium text-highlighted">{{ c.name }}</p>
                <p v-if="c.industry" class="truncate text-sm text-muted">{{ c.industry.name }}</p>
              </div>
              <p
                v-if="c.locations.length"
                class="flex min-w-0 items-center gap-1 text-sm text-muted lg:flex-1"
              >
                <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
                <span class="truncate">{{ places(c) }}</span>
              </p>
              <div class="flex shrink-0 gap-2">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-briefcase"
                  data-testid="companies-row-listings"
                  >{{ plural(c.listingCount, 'listing') }}</UBadge
                >
                <UBadge
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-send"
                  data-testid="companies-row-applications"
                  >{{ plural(c.applicationCount, 'application') }}</UBadge
                >
              </div>
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <!-- UPagination still renders a lone "1" with disabled arrows when everything fits on one page. -->
      <div v-if="totalCount > pageSize" class="flex justify-center sm:justify-end">
        <UPagination
          :page="page"
          :total="totalCount"
          :items-per-page="pageSize"
          :disabled="loading"
          data-testid="companies-pagination"
          @update:page="goTo"
        />
      </div>
    </template>
  </div>
</template>
