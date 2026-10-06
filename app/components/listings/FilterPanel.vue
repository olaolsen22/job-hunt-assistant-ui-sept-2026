<script setup lang="ts">
import type { ListingsFacets, ListingsSort } from '~/composables/useListingsList'
import { APPLICATION_STATUS_OPTIONS, LANGUAGE_OPTIONS } from '~/constants/listing'

const facets = defineModel<ListingsFacets>('facets', { required: true })
const sort = defineModel<ListingsSort>('sort', { required: true })
const search = defineModel<string>('search', { required: true })

const SORT_OPTIONS = [
  { label: 'Due date', value: 'due' },
  { label: 'Newest added', value: 'newest' },
  { label: 'Recently changed', value: 'changed' }
]

const activeCount = computed(() => countActiveFacets(facets.value))
// Closed by default at every width; the badge and Clear all keep active filters visible.
const open = ref(false)
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3 md:flex md:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search title, company, role"
        class="col-span-2 w-full md:flex-1"
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
      <USelect
        v-model="sort"
        :items="SORT_OPTIONS"
        class="w-full md:w-48"
        data-testid="listings-sort"
      />
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-sliders-horizontal"
        :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="justify-center"
        data-testid="listings-filters-toggle"
        @click="open = !open"
      >
        Filters
        <UBadge v-if="activeCount" size="sm">{{ activeCount }}</UBadge>
      </UButton>
      <UButton
        v-if="activeCount"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        class="col-span-2 justify-center"
        data-testid="listings-filters-clear"
        @click="Object.assign(facets, emptyFacets())"
        >Clear all</UButton
      >
    </div>

    <div v-if="open" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <USelectMenu
        v-model="facets.statuses"
        :items="[...APPLICATION_STATUS_OPTIONS]"
        value-key="value"
        multiple
        placeholder="Status"
        :search-input="false"
        data-testid="listings-facet-status"
      />
      <ListingsFilterCombobox
        v-model="facets.skills"
        lookup="skills"
        placeholder="Skill"
        data-testid="listings-facet-skill"
      />
      <ListingsFilterCombobox
        v-model="facets.locationIds"
        lookup="locations"
        placeholder="Location"
        data-testid="listings-facet-location"
      />
      <USelectMenu
        v-model="facets.postingLanguages"
        :items="[...LANGUAGE_OPTIONS]"
        value-key="value"
        multiple
        placeholder="Posting language"
        :search-input="false"
        data-testid="listings-facet-postingLanguage"
      />
      <USelectMenu
        v-model="facets.languages"
        :items="[...LANGUAGE_OPTIONS]"
        value-key="value"
        multiple
        placeholder="Required language"
        :search-input="false"
        data-testid="listings-facet-requiredLanguage"
      />
      <USwitch
        v-model="facets.favorites"
        label="Favorites only"
        data-testid="listings-facet-favorites"
      />
    </div>
  </div>
</template>
