<script setup lang="ts">
import { parse, print } from '@0no-co/graphql.web'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { measurePageSize, pageFromQuery, useContactsView } from '~/composables/useListingsList'

definePageMeta({ title: 'People' })

// Like /companies: `first: 20` is replaced by the measured page size, and the due filter is spliced
// in as text, since the API's cost check rejects a `first` or ContactFilterInput variable (HC0047).
// `due` counts every due follow-up for the tab badge, whatever the search.
const CONTACTS = graphql(
  `
    query Contacts($search: String, $after: String, $today: LocalDate!) {
      contacts(search: $search, first: 20, after: $after, order: [{ name: ASC }]) {
        nodes {
          ...ContactFields
          company {
            id
            name
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
      due: contacts(where: { followUpOn: { lte: $today } }) {
        totalCount
      }
    }
  `,
  [CONTACT_FIELDS]
)

const route = useRoute()
const router = useRouter()
const initialSearch = String(route.query.search ?? '').trim()
const search = ref(initialSearch)
const settledSearch = ref(initialSearch)
// "Follow-up due" is a tab in the URL, so the dashboard's View all can open it.
const due = ref(route.query.due === '1')
const tab = computed({
  get: () => (due.value ? 'due' : 'all'),
  set: (value: string) => (due.value = value === 'due')
})
const grid = useTemplateRef('grid')
const pageSize = ref(5)

const contactsQuery = () => {
  let source = print(CONTACTS).replace('first: 20', `first: ${pageSize.value}`)
  // Only the main field's order mentions name; the oldest due follow-up comes first.
  if (due.value)
    source = source.replace(
      /order: \[\{\s*name: ASC\s*\}\]/,
      'where: { followUpOn: { lte: $today } }, order: [{ followUpOn: ASC }]'
    )
  return parse(source) as typeof CONTACTS
}
const variables = (after: string | null) => ({
  search: settledSearch.value || null,
  after,
  today: todayIso()
})

const { page, after, walking, reset, remember, goTo: walkTo } = useCursorPages()

watch(
  search,
  useDebounce((value: string) => {
    settledSearch.value = value.trim()
    reset()
  }, 300)
)
watch(due, reset)

// `replace`, like /companies: the person page's Back returns to the last of these URLs.
const lastView = useContactsView()
lastView.value = route.fullPath
watch([page, settledSearch, due], () => {
  const to = router.resolve({
    path: route.path,
    query: {
      ...(settledSearch.value && { search: settledSearch.value }),
      ...(due.value && { due: '1' }),
      ...(page.value > 1 && { page: String(page.value) })
    }
  })
  lastView.value = to.fullPath
  router.replace(to)
})

const { data, status, error, execute } = useAsyncData(
  'contacts',
  () => gql(contactsQuery(), variables(after.value)),
  { watch: [page, settledSearch, due], server: false, immediate: false }
)

const goTo = (target: number) =>
  walkTo(target, async (after) => (await gql(contactsQuery(), variables(after))).contacts!.pageInfo)

// Measured like /companies once the grid is in the DOM: rows are one line from `md`, three below.
onMounted(async () => {
  const rowHeight = window.matchMedia('(min-width: 768px)').matches ? 72 : 112
  pageSize.value = measurePageSize(grid.value!, rowHeight, 12)
  const initialPage = pageFromQuery(route.query.page)
  if (initialPage > 1) await goTo(initialPage)
  if (page.value === 1) execute()
})

const contacts = computed(() => data.value?.contacts?.nodes ?? [])
const totalCount = computed(() => data.value?.contacts?.totalCount ?? 0)
const dueCount = computed(() => data.value?.due?.totalCount)
const loading = computed(
  () => walking.value || status.value === 'pending' || status.value === 'idle'
)
watch(data, () => remember(data.value?.contacts?.pageInfo))

const tabItems = computed(() => [
  { label: 'All', value: 'all', icon: 'i-lucide-users' },
  {
    label: 'Follow-up due',
    value: 'due',
    icon: 'i-lucide-bell-ring',
    badge:
      dueCount.value === undefined
        ? undefined
        : { label: String(dueCount.value), color: 'neutral' as const, variant: 'soft' as const }
  }
])

const emptyText = computed(() =>
  settledSearch.value
    ? 'No people match.'
    : due.value
      ? 'Nothing to follow up.'
      : 'No people yet. Add them to a company, or research a company to find them.'
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search people"
        class="w-full sm:max-w-sm"
        data-testid="contacts-search"
      >
        <template v-if="search" #trailing>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            aria-label="Clear search"
            @click="search = ''"
          />
        </template>
      </UInput>
      <UTabs
        v-model="tab"
        :items="tabItems"
        :content="false"
        variant="pill"
        size="sm"
        aria-label="Show"
        class="sm:ml-auto"
        data-testid="contacts-tabs"
      />
    </div>

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div
      v-else-if="!loading && contacts.length === 0"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="contacts-empty"
    >
      <UIcon :name="due ? 'i-lucide-bell' : 'i-lucide-contact-round'" class="size-10 text-muted" />
      <p>{{ emptyText }}</p>
      <UButton v-if="!settledSearch && !due" to="/companies" color="neutral" variant="subtle"
        >Go to companies</UButton
      >
    </div>

    <template v-else>
      <p
        v-if="contacts.length"
        class="text-lg font-semibold text-highlighted"
        data-testid="contacts-total"
      >
        {{ totalCount }} {{ totalCount === 1 ? 'person' : 'people' }}
      </p>

      <div ref="grid" class="grid gap-3" data-testid="contacts-list">
        <template v-if="loading && contacts.length === 0">
          <USkeleton v-for="i in pageSize" :key="i" class="h-24 w-full md:h-16" />
        </template>
        <UCard
          v-for="c in contacts"
          v-else
          :key="c.id"
          class="relative transition hover:bg-elevated"
          data-testid="contacts-row"
        >
          <div class="flex flex-col gap-1 md:flex-row md:items-center md:gap-6">
            <div class="min-w-0 md:flex-1">
              <div class="flex items-center justify-between gap-2 md:justify-start">
                <!-- The ::after overlay makes the whole card the link, like /companies. -->
                <NuxtLink
                  :to="`/contacts/${c.id}`"
                  class="truncate font-medium text-highlighted after:absolute after:inset-0"
                  data-testid="contacts-row-link"
                  >{{ c.name }}</NuxtLink
                >
                <ContactsFollowUpChip v-if="c.followUpOn" :follow-up-on="c.followUpOn" />
              </div>
              <p class="truncate text-sm text-muted">
                {{ [c.title, c.company.name].filter(Boolean).join(' · ') }}
              </p>
            </div>
            <p class="shrink-0 text-sm text-muted">
              {{
                c.lastInteractionAt
                  ? `Last contacted ${daysAgoLabel(c.lastInteractionAt)}`
                  : 'Not contacted yet'
              }}
            </p>
          </div>
        </UCard>
      </div>

      <div v-if="totalCount > pageSize" class="flex justify-center sm:justify-end">
        <UPagination
          :page="page"
          :total="totalCount"
          :items-per-page="pageSize"
          :disabled="loading"
          data-testid="contacts-pagination"
          @update:page="goTo"
        />
      </div>
    </template>
  </div>
</template>
