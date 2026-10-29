<script setup lang="ts">
import type { ListingsFilter } from '~/composables/useListingsList'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Job listings' })

const grid = useTemplateRef('grid')
const {
  listings,
  totalCount,
  counts,
  page,
  pageSize,
  filter,
  search,
  sort,
  facets,
  loading,
  error,
  refresh
} = useListingsList(grid)

const narrowed = computed(() => !!(filter.value || search.value || countActiveFacets(facets)))
// Before the first response there is nothing to count yet; the toolbar still shows so the list
// is measured at its final height.
const firstLoad = computed(() => loading.value && listings.value.length === 0)

// The everyday presets are tabs; the rarely used ones sit in a "More" menu so the row stays short.
// "All" makes the no-preset state a visible choice, so a preset is left by picking another one.
const TAB_PRESETS = [
  { value: null, label: 'All', icon: 'i-lucide-list' },
  { value: 'closingSoon', label: 'Closing soon', icon: 'i-lucide-alarm-clock' },
  { value: 'toAnalyze', label: 'To analyze', icon: 'i-lucide-clock' }
] as const
const MORE_PRESETS = [
  { value: 'withExpired', label: 'Incl. expired', icon: 'i-lucide-calendar-x' },
  { value: 'archived', label: 'Archived', icon: 'i-lucide-archive' }
] as const

const presetCount = (value: ListingsFilter | null) => counts.value[value ?? 'all']
// "Incl. expired" only earns its place when it would show more than "All".
const presetVisible = (value: ListingsFilter | null) =>
  !value ||
  filter.value === value ||
  (value === 'withExpired' ? counts.value.withExpired > counts.value.all : !!presetCount(value))

// UTabs can't hold null, so "all" stands for no preset. A "More" preset matches no tab, leaving
// none selected while the menu button shows it instead.
const tab = computed({
  get: () => filter.value ?? 'all',
  set: (value: string) => (filter.value = value === 'all' ? null : (value as ListingsFilter))
})
const tabItems = computed(() =>
  TAB_PRESETS.filter((p) => presetVisible(p.value)).map((p) => ({
    label: p.label,
    icon: p.icon,
    value: p.value ?? 'all',
    badge: firstLoad.value
      ? undefined
      : { label: String(presetCount(p.value)), color: 'neutral' as const, variant: 'soft' as const }
  }))
)

// Phones pick from every visible preset in one select; the count rides in the label.
const presetItems = computed(() =>
  [...TAB_PRESETS, ...MORE_PRESETS]
    .filter((p) => presetVisible(p.value))
    .map((p) => ({
      label: firstLoad.value ? p.label : `${p.label} · ${presetCount(p.value)}`,
      value: p.value ?? 'all'
    }))
)
const presetIcon = computed(
  () => [...TAB_PRESETS, ...MORE_PRESETS].find((p) => p.value === filter.value)?.icon
)

const moreActive = computed(() => MORE_PRESETS.find((p) => p.value === filter.value))
const moreItems = computed(() =>
  MORE_PRESETS.filter((p) => presetVisible(p.value)).map((p) => ({
    label: p.label,
    icon: p.icon,
    count: presetCount(p.value),
    onSelect: () => (filter.value = p.value)
  }))
)

const heading = computed(() => {
  const n = totalCount.value
  const plural = `listing${n === 1 ? '' : 's'}`
  if (filter.value === 'withExpired') return `${n} ${plural} incl. expired`
  const adjective = filter.value === 'archived' ? 'archived' : 'active'
  return `${n} ${adjective} ${plural}`
})

const SORT_OPTIONS = [
  { label: 'Due date', value: 'due' },
  { label: 'Newest posted', value: 'posted' },
  { label: 'Newest added', value: 'newest' },
  { label: 'Recently changed', value: 'changed' }
]

const clearEverything = () => {
  Object.assign(facets, emptyFacets())
  filter.value = null
  search.value = ''
}

const ADD_ITEMS = [
  { label: 'Add listing', icon: 'i-lucide-plus', to: '/listings/add' },
  { label: 'Quick add', icon: 'i-lucide-list-plus', to: '/listings/quick-add' }
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <!-- "Active" listings because those past their deadline are filtered out server-side. -->
      <USkeleton v-if="firstLoad" class="h-7 w-40" />
      <p
        v-else-if="listings.length || narrowed"
        class="text-lg font-semibold text-highlighted"
        data-testid="listings-total"
      >
        {{ heading }}
      </p>
      <div class="hidden gap-2 sm:flex">
        <UButton
          to="/listings/quick-add"
          icon="i-lucide-list-plus"
          color="neutral"
          variant="subtle"
          data-testid="quick-add-open"
          >Quick add</UButton
        >
        <UButton to="/listings/add" icon="i-lucide-plus">Add listing</UButton>
      </div>
      <UDropdownMenu :items="ADD_ITEMS" class="sm:hidden">
        <UButton icon="i-lucide-plus" trailing-icon="i-lucide-chevron-down" aria-label="Add" />
      </UDropdownMenu>
    </div>

    <!-- Kept while a filter is on, so an empty filtered page can still clear it.
         `:facets`, not v-model: the panel edits the composable's reactive object in place. -->
    <template v-if="loading || listings.length || narrowed">
      <!-- Presets and sort share one row. Phones get two equal selects, because the pill tabs
           squash their labels at that width; from md there is room for the tabs, sort goes right. -->
      <div class="flex items-center gap-2">
        <USelect
          v-model="tab"
          :items="presetItems"
          :icon="presetIcon"
          aria-label="Show"
          class="min-w-0 flex-1 md:hidden"
          data-testid="listings-presets-select"
        />
        <div class="hidden min-w-0 items-center gap-2 md:flex">
          <UTabs
            v-model="tab"
            :items="tabItems"
            :content="false"
            variant="pill"
            size="sm"
            aria-label="Show"
            data-testid="listings-presets"
          />
          <UDropdownMenu v-if="moreItems.length" :items="moreItems">
            <UButton
              :color="moreActive ? 'primary' : 'neutral'"
              :variant="moreActive ? 'soft' : 'ghost'"
              size="sm"
              :icon="moreActive?.icon"
              trailing-icon="i-lucide-chevron-down"
              class="shrink-0"
              data-testid="listings-presets-more"
              >{{ moreActive?.label ?? 'More' }}</UButton
            >
            <template #item-trailing="{ item }">
              <span class="text-muted tabular-nums">{{ item.count }}</span>
            </template>
          </UDropdownMenu>
        </div>
        <!-- Sort orders the list rather than narrowing it, so it lives here, not in the Filters
             sheet. A visible value, not an icon menu, so the current order reads at a glance. -->
        <USelect
          v-model="sort"
          :items="SORT_OPTIONS"
          icon="i-lucide-arrow-up-down"
          aria-label="Sort by"
          class="min-w-0 flex-1 md:ml-auto md:w-48 md:flex-none"
          data-testid="listings-sort"
        />
      </div>

      <ListingsFilterPanel
        v-model:search="search"
        :facets="facets"
        :quick-counts="counts"
        :company-name="facets.companyId ? listings[0]?.company.name : undefined"
      />
    </template>

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div
      v-else-if="!loading && listings.length === 0"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="listings-empty"
    >
      <UIcon name="i-lucide-inbox" class="size-10 text-muted" />
      <p>{{ narrowed ? 'No listings match.' : 'No listings yet.' }}</p>
      <UButton v-if="!narrowed" to="/listings/add">Add listing</UButton>
      <UButton
        v-else
        color="neutral"
        variant="subtle"
        data-testid="listings-empty-clear"
        @click="clearEverything"
        >Clear search and filters</UButton
      >
    </div>

    <template v-else>
      <ul
        ref="grid"
        class="space-y-3 md:divide-y md:divide-default md:space-y-0 md:overflow-hidden md:rounded-lg md:border md:border-default"
        data-testid="listings-grid"
      >
        <!-- Column labels only where the row is a real column layout (lg+); widths mirror Row.vue.
             A <li> so the divider and padding match the rows exactly. -->
        <li
          class="hidden gap-4 px-4 py-2 text-xs font-medium text-muted uppercase lg:flex"
          aria-hidden="true"
        >
          <span class="w-8 shrink-0" />
          <span class="min-w-48 flex-1">Title</span>
          <span class="w-40 shrink-0">Location</span>
          <span class="w-16 shrink-0">Seniority</span>
          <span class="w-20 shrink-0">Posted</span>
          <span class="w-44 shrink-0">Due</span>
          <span class="w-52 shrink-0">Status</span>
          <span class="w-17 shrink-0" />
        </li>
        <template v-if="firstLoad">
          <li v-for="i in pageSize" :key="i" class="p-3 md:px-4">
            <USkeleton class="h-24 w-full md:h-10" />
          </li>
        </template>
        <ListingsRow
          v-for="listing in listings"
          v-else
          :key="listing.id"
          :listing="listing"
          @changed="refresh"
        />
      </ul>

      <!-- UPagination still renders a lone "1" with disabled arrows when everything fits on one page. -->
      <div v-if="totalCount > pageSize" class="flex justify-center sm:justify-end">
        <UPagination
          v-model:page="page"
          :total="totalCount"
          :items-per-page="pageSize"
          :disabled="loading"
          data-testid="listings-pagination"
        />
      </div>
    </template>
  </div>
</template>
