<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useMediaQuery } from '@vueuse/core'
import type { ListingListItem, ListingsSort } from '~/composables/useListingsList'

// Desktop view of the list page (xl+); phones and tablets get ListingsRow instead.
// Sorting is server-side (the list is paginated), so a header click only changes `sort`.
const { listings, loading, skeletonRows } = defineProps<{
  listings: ListingListItem[]
  loading: boolean
  // Rows to fake while the first page loads, so the pager doesn't jump when data arrives.
  skeletonRows: number
}>()
const sort = defineModel<ListingsSort>('sort', { required: true })
defineEmits<{ changed: [] }>()

// Widths keep the columns aligned across pages; Title takes what is left.
const columns: TableColumn<ListingListItem>[] = [
  { id: 'favorite', meta: { class: { th: 'w-12', td: 'w-12' } } },
  { id: 'title', header: 'Title' },
  { id: 'location', header: 'Location', meta: { class: { th: 'w-36', td: 'w-36' } } },
  { id: 'seniority', header: 'Seniority', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'posted', header: 'Posted', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'due', header: 'Due', meta: { class: { th: 'w-44', td: 'w-44' } } },
  // Wide enough for the longest pair, "Interviewing" + "To analyze", on one line.
  { id: 'status', header: 'Status', meta: { class: { th: 'w-56', td: 'w-56' } } },
  { id: 'actions', meta: { class: { th: 'w-24', td: 'w-24' } } }
]

// From 1280 to 1440 the sidebar leaves too little room for every column, so Seniority is left out
// (not rendered, like the list/table swap) and joins the company line under the title instead.
const wide = useMediaQuery('(min-width: 90rem)')
const columnVisibility = computed(() => ({ seniority: wide.value }))

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
    :data="listings"
    :columns="columns"
    :loading="loading"
    :column-visibility="columnVisibility"
    :ui="{
      base: 'w-full table-fixed',
      tr: 'group relative hover:bg-elevated/50',
      th: 'py-2 text-xs font-medium uppercase text-muted'
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
      <AppFavoriteButton
        :id="row.original.id"
        target="listing"
        :favorited-at="row.original.favoritedAt"
        size="md"
        class="relative z-10"
      />
    </template>

    <template #title-cell="{ row }">
      <NuxtLink
        :to="`/listings/${row.original.id}`"
        class="line-clamp-2 font-semibold whitespace-normal text-highlighted group-hover:underline after:absolute after:inset-0"
        data-testid="listing-title"
        >{{ row.original.title }}</NuxtLink
      >
      <ListingsCompanyLine :listing="row.original" :with-seniority="!wide" truncate />
    </template>

    <template #location-cell="{ row }">
      <p
        class="truncate"
        :title="row.original.locations.map((l) => formatLocation(l.location)).join(', ')"
        data-testid="listing-location"
      >
        {{ listingFirstLocation(row.original) }}
        <span v-if="listingMoreLocations(row.original)" class="text-dimmed"
          >+{{ listingMoreLocations(row.original) }}</span
        >
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
      <div class="flex flex-wrap gap-1">
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
