<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useElementSize } from '@vueuse/core'
import type { ListingListItem, ListingsSort } from '~/composables/useListingsList'

// Used when the results area has at least 48rem; narrower areas get ListingsRow instead.
// Sorting is server-side (the list is paginated), so a header click only changes `sort`.
const { listings, loading, skeletonRows } = defineProps<{
  listings: ListingListItem[]
  loading: boolean
  // Rows to fake while the first page loads, so the pager doesn't jump when data arrives.
  skeletonRows: number
}>()
const sort = defineModel<ListingsSort>('sort', { required: true })
defineEmits<{ changed: [] }>()

// Compact tables keep the title, dates, status and actions aligned in columns.
// Location gets a separate column only when it leaves enough room for the title.
const columns: TableColumn<ListingListItem>[] = [
  { id: 'favorite', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'title', header: 'Title' },
  { id: 'location', header: 'Location', meta: { class: { th: 'w-40', td: 'w-40' } } },
  { id: 'seniority', header: 'Seniority', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'posted', header: 'Posted', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'due', header: 'Due', meta: { class: { th: 'w-40', td: 'w-40' } } },
  { id: 'status', header: 'Status', meta: { class: { th: 'w-32', td: 'w-32' } } },
  { id: 'actions', meta: { class: { th: 'w-24', td: 'w-24' } } }
]

// Measure the table itself: both navigation and filters can reduce its available width.
// The ref is UTable's instance, so measure its root element.
const table = useTemplateRef('table')
const { width } = useElementSize(() => table.value?.$el)
const wide = computed(() => width.value >= 1216)
const detailed = computed(() => width.value >= 1056)
const columnVisibility = computed(() => ({
  seniority: wide.value,
  location: detailed.value
}))

const locationLabel = (listing: ListingListItem) =>
  listing.locations.map((l) => formatLocation(l.location)).join(', ') || 'Location not specified'

// First click picks the natural direction (A–Z, newest posted first), the second reverses it, the
// third goes back to the default due order. Due itself has no reverse: the server's due date isn't
// sortable, only its default order is (see ORDERS in useListingsList).
const SORTABLE = {
  title: { first: 'title-asc', second: 'title-desc', firstIcon: 'i-lucide-arrow-up-a-z' },
  seniority: { first: 'seniority-asc', second: 'seniority-desc', firstIcon: 'i-lucide-arrow-up' },
  posted: { first: 'posted', second: 'posted-asc', firstIcon: 'i-lucide-arrow-down' },
  due: { first: 'due', second: null, firstIcon: 'i-lucide-arrow-up' },
  status: { first: 'status-asc', second: 'status-desc', firstIcon: 'i-lucide-arrow-up' }
} as const satisfies Record<
  string,
  { first: ListingsSort; second: ListingsSort | null; firstIcon: string }
>
type SortableKey = keyof typeof SORTABLE
const sortableKeys = Object.keys(SORTABLE) as SortableKey[]

const REVERSED_ICON: Record<string, string> = {
  'i-lucide-arrow-up-a-z': 'i-lucide-arrow-down-z-a',
  'i-lucide-arrow-up': 'i-lucide-arrow-down',
  'i-lucide-arrow-down': 'i-lucide-arrow-up'
}

const headerState = (key: SortableKey) => {
  const { first, second, firstIcon } = SORTABLE[key]
  if (sort.value === first) return { active: true, icon: firstIcon }
  if (sort.value === second) return { active: true, icon: REVERSED_ICON[firstIcon] }
  return { active: false, icon: 'i-lucide-arrow-up-down' }
}

const nextSort = (key: SortableKey): ListingsSort => {
  const { first, second } = SORTABLE[key]
  if (sort.value === first) return second ?? first
  if (sort.value === second) return 'due'
  return first
}

const LABELS: Record<SortableKey, string> = {
  title: 'Title',
  seniority: 'Seniority',
  posted: 'Posted',
  due: 'Due',
  status: 'Status'
}
</script>

<template>
  <!-- table-fixed so the column widths hold and long titles clamp instead of pushing columns out.
       `relative` on the row anchors the title link's stretched ::after, so the whole row is a real
       link (middle-click, new tab) like the phone/tablet rows. -->
  <UTable
    ref="table"
    :data="listings"
    :columns="columns"
    :loading="loading"
    :column-visibility="columnVisibility"
    :ui="{
      base: 'w-full min-w-[48rem] max-w-[83rem] table-fixed',
      tr: 'group relative hover:bg-elevated/50',
      th: 'px-3 py-2 text-xs font-medium uppercase text-muted',
      td: 'px-3'
    }"
    data-testid="listings-table"
  >
    <template v-for="key in sortableKeys" :key="key" #[`${key}-header`]>
      <UButton
        :label="LABELS[key]"
        :trailing-icon="headerState(key).icon"
        color="neutral"
        variant="ghost"
        size="xs"
        class="-mx-2 uppercase"
        :class="headerState(key).active ? 'text-highlighted' : 'text-muted'"
        :aria-label="`${LABELS[key]}${headerState(key).active ? ', sorted' : ''}. Change sort`"
        :data-testid="`listings-sort-${key}`"
        @click="sort = nextSort(key)"
      />
    </template>

    <template #favorite-cell="{ row }">
      <div class="flex items-center">
        <ListingsShortlistButton
          :id="row.original.id"
          :shortlisted-at="row.original.shortlistedAt"
          size="md"
          class="relative z-10"
          @changed="$emit('changed')"
        />
        <AppFavoriteButton
          :id="row.original.id"
          target="listing"
          :favorited-at="row.original.favoritedAt"
          size="md"
          class="relative z-10"
        />
      </div>
    </template>

    <template #title-cell="{ row }">
      <NuxtLink
        :to="`/listings/${row.original.id}`"
        class="line-clamp-2 font-semibold whitespace-normal wrap-anywhere text-highlighted group-hover:underline after:absolute after:inset-0"
        data-testid="listing-title"
        >{{ row.original.title }}</NuxtLink
      >
      <ListingsCompanyLine :listing="row.original" :with-seniority="!wide" truncate />
      <p
        v-if="!detailed"
        class="mt-1 truncate text-xs text-muted"
        :title="locationLabel(row.original)"
        data-testid="listing-location"
      >
        {{ locationLabel(row.original) }}
      </p>
    </template>

    <template #location-cell="{ row }">
      <p
        class="line-clamp-2 whitespace-normal wrap-break-word"
        :title="locationLabel(row.original)"
        data-testid="listing-location"
      >
        {{ locationLabel(row.original) }}
      </p>
    </template>

    <template #seniority-cell="{ row }">
      {{ listingSeniority(row.original) ?? '—' }}
    </template>

    <template #posted-cell="{ row }">
      <!-- z-10 keeps the date tooltips reachable above the stretched link. -->
      <ListingsPostedBadge
        v-if="row.original.postedOn"
        :posted-on="row.original.postedOn"
        compact
        class="relative z-10"
      />
    </template>

    <template #due-cell="{ row }">
      <ListingsDueChip :listing="row.original" class="relative z-10" />
    </template>

    <template #status-cell="{ row }">
      <div class="flex flex-col items-start gap-1">
        <ListingsStatusBadge :status="row.original.status" />
        <ListingsAnalyzedBadge v-if="!row.original.analyzedAt" :analyzed-at="null" />
      </div>
    </template>

    <template #actions-cell="{ row }">
      <ListingsRowActions
        :listing="row.original"
        class="relative z-10"
        @changed="$emit('changed')"
      />
    </template>

    <!-- Shown instead of the body while the first page loads; later loads keep the old rows. -->
    <template v-if="!listings.length" #loading>
      <div class="space-y-3 text-left">
        <USkeleton v-for="i in skeletonRows" :key="i" class="h-10 w-full" />
      </div>
    </template>
  </UTable>
</template>
