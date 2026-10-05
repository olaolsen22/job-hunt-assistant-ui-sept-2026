<script setup lang="ts">
import type { ListingsFilter } from '~/composables/useListingsList'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Job listings' })

const { listings, totalCount, counts, page, pageSize, filter, search, loading, error } =
  useListingsList()

// Clicking the active filter clears it.
const toggle = (value: ListingsFilter) => (filter.value = filter.value === value ? null : value)

const FILTERS = [
  { value: 'closingSoon', label: 'closing soon', color: 'error', icon: 'i-lucide-alarm-clock' },
  { value: 'toAnalyze', label: 'to analyze', color: 'warning', icon: 'i-lucide-clock' },
  { value: 'active', label: 'active applications', color: 'info', icon: 'i-lucide-send' },
  { value: 'archived', label: 'archived', color: 'neutral', icon: 'i-lucide-archive' }
] as const

const heading = computed(() => {
  const n = totalCount.value
  const adjective = filter.value === 'archived' ? 'archived' : 'active'
  const noun = filter.value === 'active' ? 'application' : 'listing'
  return `${n} ${adjective} ${noun}${n === 1 ? '' : 's'}`
})
</script>

<template>
  <div class="space-y-6">
    <UInput
      v-if="listings.length || filter || search"
      v-model="search"
      icon="i-lucide-search"
      placeholder="Search title, company, role"
      class="w-full sm:max-w-sm"
      data-testid="listings-search"
    >
      <template v-if="search" #trailing>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          data-testid="listings-search-clear"
          @click="search = ''"
        />
      </template>
    </UInput>

    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <!-- "Active" listings because those past their deadline are filtered out server-side.
           Kept visible while a filter is on, so an empty filtered page can still clear it. -->
      <div v-if="listings.length || filter || search" class="flex flex-wrap items-center gap-2">
        <p class="text-lg font-semibold text-highlighted" data-testid="listings-total">
          {{ heading }}
        </p>
        <template v-for="f in FILTERS" :key="f.value">
          <UButton
            v-if="counts[f.value] || filter === f.value"
            :color="f.color"
            :variant="filter === f.value ? 'solid' : 'subtle'"
            size="sm"
            :icon="f.icon"
            :trailing-icon="filter === f.value ? 'i-lucide-x' : undefined"
            :data-testid="`listings-filter-${f.value}`"
            @click="toggle(f.value)"
            >{{ counts[f.value] }} {{ f.label }}</UButton
          >
        </template>
      </div>
      <div class="flex flex-col gap-2 sm:ml-auto sm:flex-row">
        <UButton
          to="/listings/quick-add"
          icon="i-lucide-list-plus"
          color="neutral"
          variant="subtle"
          class="justify-center"
          data-testid="quick-add-open"
          >Quick add</UButton
        >
        <UButton to="/listings/add" icon="i-lucide-plus" class="justify-center">
          Add listing
        </UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div
      v-else-if="loading && listings.length === 0"
      class="grid gap-4 lg:grid-cols-2"
      data-testid="listings-loading"
    >
      <USkeleton v-for="i in 6" :key="i" class="h-28 w-full" />
    </div>

    <div
      v-else-if="listings.length === 0"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="listings-empty"
    >
      <UIcon name="i-lucide-inbox" class="size-10 text-muted" />
      <p>{{ filter || search ? 'No listings match.' : 'No listings yet.' }}</p>
      <UButton v-if="!filter && !search" to="/listings/add">Add listing</UButton>
    </div>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-2" data-testid="listings-grid">
        <ListingsCard v-for="listing in listings" :key="listing.id" :listing="listing" />
      </div>

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
