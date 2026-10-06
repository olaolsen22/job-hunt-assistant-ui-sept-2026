<script setup lang="ts">
import type { ListingsFacets, ListingsSort } from '~/composables/useListingsList'
import { APPLICATION_STATUS_OPTIONS, LANGUAGE_OPTIONS } from '~/constants/listing'

const facets = defineModel<ListingsFacets>('facets', { required: true })
const sort = defineModel<ListingsSort>('sort', { required: true })

const SORT_OPTIONS = [
  { label: 'Due date', value: 'due' },
  { label: 'Newest added', value: 'newest' },
  { label: 'Recently changed', value: 'changed' }
]

const activeCount = computed(() => countActiveFacets(facets.value))
// Phones only: from md up the facets are always shown, so this just swaps `max-md:hidden`.
// A class swap, not a JS media query, keeps the server render and hydration identical.
const open = ref(false)
const facetClass = computed(() => ['col-span-2 md:col-span-1', open.value ? '' : 'max-md:hidden'])
</script>

<template>
  <div class="grid grid-cols-2 items-center gap-3 md:grid-cols-4">
    <UButton
      color="neutral"
      variant="subtle"
      icon="i-lucide-sliders-horizontal"
      :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      class="order-first justify-center md:hidden"
      data-testid="listings-filters-toggle"
      @click="open = !open"
    >
      Filters
      <UBadge v-if="activeCount" size="sm">{{ activeCount }}</UBadge>
    </UButton>

    <USwitch
      v-model="facets.favorites"
      label="Favorites only"
      :class="facetClass"
      data-testid="listings-facet-favorites"
    />
    <USelectMenu
      v-model="facets.statuses"
      :items="[...APPLICATION_STATUS_OPTIONS]"
      value-key="value"
      multiple
      placeholder="Status"
      :search-input="false"
      :class="facetClass"
      data-testid="listings-facet-status"
    />
    <ListingsFilterCombobox
      v-model="facets.skills"
      lookup="skills"
      placeholder="Skill"
      :class="facetClass"
      data-testid="listings-facet-skill"
    />
    <ListingsFilterCombobox
      v-model="facets.locationIds"
      lookup="locations"
      placeholder="Location"
      :class="facetClass"
      data-testid="listings-facet-location"
    />
    <USelectMenu
      v-model="facets.postingLanguages"
      :items="[...LANGUAGE_OPTIONS]"
      value-key="value"
      multiple
      placeholder="Posting language"
      :search-input="false"
      :class="facetClass"
      data-testid="listings-facet-postingLanguage"
    />
    <USelectMenu
      v-model="facets.languages"
      :items="[...LANGUAGE_OPTIONS]"
      value-key="value"
      multiple
      placeholder="Required language"
      :search-input="false"
      :class="facetClass"
      data-testid="listings-facet-requiredLanguage"
    />
    <!-- First on phones, next to the toggle: sort isn't a facet, so it stays visible when closed. -->
    <USelect
      v-model="sort"
      :items="SORT_OPTIONS"
      class="w-full max-md:order-first"
      data-testid="listings-sort"
    />
    <UButton
      v-if="activeCount"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      :class="[facetClass, 'justify-center md:justify-self-end']"
      data-testid="listings-filters-clear"
      @click="Object.assign(facets, emptyFacets())"
      >Clear all</UButton
    >
  </div>
</template>
