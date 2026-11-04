<script setup lang="ts">
import type { CompaniesFacets } from '~/utils/companiesQuery'
import { COMPANY_SIZE_OPTIONS, companySizeRange } from '~/constants/company'
import { LANGUAGE_OPTIONS, WORK_MODE_OPTIONS } from '~/constants/listing'

// Same toolbar, chips and sheet as /listings, with the company facets.
const facets = defineModel<CompaniesFacets>('facets', { required: true })
const search = defineModel<string>('search', { required: true })

const RESEARCH_ITEMS = [
  { label: 'Any', value: 'any' },
  { label: 'Researched', value: 'yes' },
  { label: 'Not researched', value: 'no' }
] as const

// Favorites sits outside the sheet, so the Filters badge and the sheet's Clear leave it alone.
const sheetCount = computed(() => countActiveCompaniesFacets({ ...facets.value, favorites: false }))
const anyActive = computed(() => countActiveCompaniesFacets(facets.value) > 0)

const labels = (options: readonly { label: string; value: string }[], values: string[]) =>
  values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')

// Locations are ids whose labels only the lookup knows, so that chip shows a count.
const chips = computed(() => {
  const f = facets.value
  return [
    f.hideAvoided && {
      key: 'hideAvoided',
      label: 'Hiding avoided',
      clear: () => (f.hideAvoided = false)
    },
    f.hasContacts && {
      key: 'contacts',
      label: 'Has contacts',
      clear: () => (f.hasContacts = false)
    },
    f.researched !== 'any' && {
      key: 'researched',
      label: f.researched === 'yes' ? 'Researched' : 'Not researched',
      clear: () => (f.researched = 'any')
    },
    f.sizeBands.length && {
      key: 'size',
      label: `Size: ${f.sizeBands.map((s) => companySizeRange(s)).join(', ')}`,
      clear: () => (f.sizeBands = [])
    },
    f.industries.length && {
      key: 'industry',
      label: `Industry: ${f.industries.join(', ')}`,
      clear: () => (f.industries = [])
    },
    f.skills.length && {
      key: 'skill',
      label: `Skill: ${f.skills.join(', ')}`,
      clear: () => (f.skills = [])
    },
    f.locationIds.length && {
      key: 'location',
      label: `Locations: ${f.locationIds.length}`,
      clear: () => (f.locationIds = [])
    },
    f.workModes.length && {
      key: 'workMode',
      label: `Work mode: ${labels(WORK_MODE_OPTIONS, f.workModes)}`,
      clear: () => (f.workModes = [])
    },
    f.languages.length && {
      key: 'language',
      label: `Language: ${labels(LANGUAGE_OPTIONS, f.languages)}`,
      clear: () => (f.languages = [])
    }
  ].filter((chip) => !!chip)
})

const clearAll = () => Object.assign(facets.value, emptyCompaniesFacets())
const clearSheet = () =>
  Object.assign(facets.value, { ...emptyCompaniesFacets(), favorites: facets.value.favorites })

const open = ref(false)
</script>

<template>
  <div class="space-y-3">
    <!-- One row at every width, like /listings: below lg the buttons shrink to icons. -->
    <div class="flex items-center gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search companies"
        aria-label="Search companies"
        class="min-w-0 flex-1 lg:max-w-md"
        data-testid="companies-search"
      >
        <template v-if="search" #trailing>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            aria-label="Clear search"
            data-testid="companies-search-clear"
            @click="search = ''"
          />
        </template>
      </UInput>
      <UButton
        :color="facets.favorites ? 'warning' : 'neutral'"
        :variant="facets.favorites ? 'soft' : 'subtle'"
        :aria-pressed="facets.favorites"
        class="shrink-0"
        data-testid="companies-facet-favorites"
        @click="facets.favorites = !facets.favorites"
      >
        <!-- Filled when on, like the listings toolbar. -->
        <UIcon
          name="i-lucide-star"
          mode="svg"
          class="size-5"
          :class="{ '[&_*]:fill-current': facets.favorites }"
        />
        <span class="max-lg:sr-only">Favorites</span>
      </UButton>
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-sliders-horizontal"
        class="shrink-0"
        data-testid="companies-filters-toggle"
        @click="open = true"
      >
        <span class="max-lg:sr-only">Filters</span>
        <UBadge v-if="sheetCount" size="sm">{{ sheetCount }}</UBadge>
      </UButton>
    </div>

    <AppFilterChips
      v-if="anyActive"
      :chips="chips"
      testid-prefix="companies"
      @clear-all="clearAll"
    />

    <AppFilterSheet
      v-model:open="open"
      testid-prefix="companies"
      :clear-disabled="!sheetCount"
      @clear="clearSheet"
    >
      <div class="space-y-3">
        <USwitch
          v-model="facets.hideAvoided"
          label="Hide avoided"
          data-testid="companies-facet-hideAvoided"
        />
        <USwitch
          v-model="facets.hasContacts"
          label="Has contacts"
          data-testid="companies-facet-contacts"
        />
      </div>
      <USeparator />
      <UFormField label="Research">
        <USelect
          v-model="facets.researched"
          :items="[...RESEARCH_ITEMS]"
          class="w-full"
          data-testid="companies-facet-researched"
        />
      </UFormField>
      <UFormField label="Size">
        <USelectMenu
          v-model="facets.sizeBands"
          :items="[...COMPANY_SIZE_OPTIONS]"
          value-key="value"
          multiple
          placeholder="Any size"
          :search-input="false"
          class="w-full"
          data-testid="companies-facet-size"
        />
      </UFormField>
      <UFormField label="Industry">
        <AppFilterCombobox
          v-model="facets.industries"
          lookup="industries"
          placeholder="Any industry"
          data-testid="companies-facet-industry"
        />
      </UFormField>
      <UFormField label="Skill">
        <AppFilterCombobox
          v-model="facets.skills"
          lookup="skills"
          placeholder="Any skill"
          data-testid="companies-facet-skill"
        />
      </UFormField>
      <UFormField label="Location">
        <AppFilterCombobox
          v-model="facets.locationIds"
          lookup="locations"
          placeholder="Any location"
          data-testid="companies-facet-location"
        />
      </UFormField>
      <UFormField label="Work mode">
        <USelectMenu
          v-model="facets.workModes"
          :items="[...WORK_MODE_OPTIONS]"
          value-key="value"
          multiple
          placeholder="Any"
          :search-input="false"
          class="w-full"
          data-testid="companies-facet-workMode"
        />
      </UFormField>
      <UFormField label="Working language">
        <USelectMenu
          v-model="facets.languages"
          :items="[...LANGUAGE_OPTIONS]"
          value-key="value"
          multiple
          placeholder="Any"
          :search-input="false"
          class="w-full"
          data-testid="companies-facet-language"
        />
      </UFormField>
    </AppFilterSheet>
  </div>
</template>
