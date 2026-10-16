<script setup lang="ts">
import type { ListingsFilter, QuickToggle } from '~/composables/useListingsList'
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

// "All" makes the no-preset state a visible choice, so a preset is left by picking another one.
const PRESETS = [
  { value: null, label: 'All', color: 'neutral', icon: 'i-lucide-list' },
  { value: 'closingSoon', label: 'Closing soon', color: 'error', icon: 'i-lucide-alarm-clock' },
  { value: 'toAnalyze', label: 'To analyze', color: 'warning', icon: 'i-lucide-clock' },
  { value: 'archived', label: 'Archived', color: 'neutral', icon: 'i-lucide-archive' }
] as const

const presetCount = (value: ListingsFilter | null) => counts.value[value ?? 'all']

// Facets, not presets: each narrows whichever preset is active, so its count does too.
const QUICK_TOGGLES: {
  key: QuickToggle
  label: string
  icon: string
  active: () => boolean
  toggle: () => void
}[] = [
  {
    key: 'preferred',
    label: 'Preferred locations',
    icon: 'i-lucide-map-pin',
    active: () => facets.preferredLocations,
    toggle: () => (facets.preferredLocations = !facets.preferredLocations)
  },
  {
    key: 'it',
    label: 'IT',
    icon: 'i-lucide-monitor',
    active: () => facets.itRoles,
    toggle: () => (facets.itRoles = !facets.itRoles)
  },
  {
    key: 'englishPosting',
    label: 'English posting',
    icon: 'i-lucide-languages',
    active: () => facets.englishPosting,
    toggle: () => (facets.englishPosting = !facets.englishPosting)
  },
  {
    key: 'englishMentioned',
    label: 'English mentioned',
    icon: 'i-lucide-message-circle',
    active: () => facets.englishMentioned,
    toggle: () => (facets.englishMentioned = !facets.englishMentioned)
  }
]

const quickVisible = computed(() => QUICK_TOGGLES.some((t) => counts.value[t.key] || t.active()))

const heading = computed(() => {
  const n = totalCount.value
  const adjective = filter.value === 'archived' ? 'archived' : 'active'
  return `${n} ${adjective} listing${n === 1 ? '' : 's'}`
})

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
      <ListingsFilterPanel v-model:search="search" v-model:sort="sort" :facets="facets" />

      <!-- Phones stack two labelled groups so nothing hides off-screen; sm+ flattens them back into one
           wrapping row (`sm:contents`) and the labels become screen-reader only. -->
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <div role="group" aria-label="Show" class="flex flex-col gap-1 sm:contents">
          <span class="text-xs text-muted sm:sr-only" aria-hidden="true">Show</span>
          <div class="flex flex-wrap items-center gap-2 sm:contents">
            <template v-for="p in PRESETS" :key="p.value ?? 'all'">
              <UButton
                v-if="!p.value || presetCount(p.value) || filter === p.value"
                :color="p.color"
                :variant="filter === p.value ? 'solid' : 'subtle'"
                size="sm"
                class="max-sm:py-2"
                :icon="p.icon"
                :aria-pressed="filter === p.value"
                :data-testid="`listings-filter-${p.value ?? 'all'}`"
                @click="filter = p.value"
                >{{ p.label }}
                <span v-if="!firstLoad" class="tabular-nums opacity-80">{{
                  presetCount(p.value)
                }}</span></UButton
              >
            </template>
          </div>
        </div>
        <div
          v-if="quickVisible"
          role="group"
          aria-label="Narrow by"
          class="flex flex-col gap-1 sm:contents"
        >
          <span class="text-xs text-muted sm:sr-only" aria-hidden="true">Narrow by</span>
          <div class="flex flex-wrap items-center gap-2 sm:contents">
            <template v-for="t in QUICK_TOGGLES" :key="t.key">
              <UButton
                v-if="counts[t.key] || t.active()"
                color="primary"
                :variant="t.active() ? 'solid' : 'outline'"
                size="sm"
                class="max-sm:py-2"
                :icon="t.active() ? 'i-lucide-check' : t.icon"
                :aria-pressed="t.active()"
                :data-testid="`listings-filter-${t.key}`"
                @click="t.toggle"
                >{{ t.label }}
                <span class="tabular-nums opacity-80">{{ counts[t.key] }}</span></UButton
              >
            </template>
          </div>
        </div>
      </div>
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
