<script setup lang="ts">
import {
  DUE_WITHIN_OPTIONS,
  type ListingsFacets,
  type ListingsSort,
  type QuickToggle
} from '~/composables/useListingsList'
import { APPLICATION_STATUS_OPTIONS, LANGUAGE_OPTIONS } from '~/constants/listing'

const facets = defineModel<ListingsFacets>('facets', { required: true })
const sort = defineModel<ListingsSort>('sort', { required: true })
const search = defineModel<string>('search', { required: true })
// The company filter holds an id; the page knows the name from the listings it shows.
// Quick counts tell how many listings each switch would leave under the active preset.
const { companyName = '', quickCounts } = defineProps<{
  companyName?: string
  quickCounts: Record<QuickToggle, number>
}>()

// Yes/no facets with a count each, at the top of the sheet.
const QUICK_TOGGLES = [
  { key: 'preferred', facet: 'preferredLocations', label: 'Preferred locations' },
  { key: 'it', facet: 'itRoles', label: 'IT roles' },
  { key: 'englishPosting', facet: 'englishPosting', label: 'English posting' },
  { key: 'englishMentioned', facet: 'englishMentioned', label: 'English mentioned' }
] as const

const SORT_OPTIONS = [
  { label: 'Due date', value: 'due' },
  { label: 'Newest posted', value: 'posted' },
  { label: 'Newest added', value: 'newest' },
  { label: 'Recently changed', value: 'changed' }
]

// USelect can't hold null, so "Any" is a sentinel that maps back to null.
const DUE_ITEMS = [
  { label: 'Due: any time', value: 0 },
  ...DUE_WITHIN_OPTIONS.map((days) => ({ label: `Due within ${days} days`, value: days }))
]

// These are set outside the sheet (Favorites, or the company from a dashboard link), so the Filters badge counts only what is inside it, and the
// sheet's own Clear leaves them alone. Clear all still resets every facet.
const outsideToggles = () => {
  const { favorites, companyId } = facets.value
  return { favorites, companyId }
}
const sheetCount = computed(() =>
  countActiveFacets({ ...facets.value, favorites: false, companyId: null })
)
const anyActive = computed(() => countActiveFacets(facets.value) > 0)

const labels = (options: readonly { label: string; value: string }[], values: string[]) =>
  values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')

// One removable chip per facet in the sheet, plus the company, so a deep link or a forgotten filter stays visible.
// Locations are ids whose labels only the lookup knows, so that chip shows a count.
const chips = computed(() => {
  const f = facets.value
  const range = [f.postedFrom && formatDate(f.postedFrom), f.postedTo && formatDate(f.postedTo)]
  return [
    f.companyId && {
      key: 'company',
      label: companyName ? `Company: ${companyName}` : 'Company',
      clear: () => (f.companyId = null)
    },
    ...QUICK_TOGGLES.map(
      (t) => f[t.facet] && { key: t.key, label: t.label, clear: () => (f[t.facet] = false) }
    ),
    f.statuses.length && {
      key: 'status',
      label: `Status: ${labels(APPLICATION_STATUS_OPTIONS, f.statuses)}`,
      clear: () => (f.statuses = [])
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
    f.postingLanguages.length && {
      key: 'postingLanguage',
      label: `Posted in: ${labels(LANGUAGE_OPTIONS, f.postingLanguages)}`,
      clear: () => (f.postingLanguages = [])
    },
    f.languages.length && {
      key: 'language',
      label: `Requires: ${labels(LANGUAGE_OPTIONS, f.languages)}`,
      clear: () => (f.languages = [])
    },
    (f.postedFrom || f.postedTo) && {
      key: 'posted',
      label: `Posted: ${range[0] || '…'} – ${range[1] || '…'}`,
      clear: () => Object.assign(f, { postedFrom: '', postedTo: '' })
    },
    f.dueWithinDays && {
      key: 'due',
      label: `Due within ${f.dueWithinDays} days`,
      clear: () => (f.dueWithinDays = null)
    }
  ].filter((chip) => !!chip)
})

const clearAll = () => Object.assign(facets.value, emptyFacets())
const clearSheet = () => Object.assign(facets.value, { ...emptyFacets(), ...outsideToggles() })

const open = ref(false)
// A side sheet from tablet up, a bottom sheet on phones. Decided on click, so SSR never needs it.
const side = ref<'right' | 'bottom'>('right')
const openSheet = () => {
  side.value = window.matchMedia('(min-width: 768px)').matches ? 'right' : 'bottom'
  open.value = true
}
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3 md:flex md:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search title, company, role"
        aria-label="Search listings"
        class="col-span-2 w-full md:flex-1"
        data-testid="listings-search"
      >
        <template v-if="search" #trailing>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            aria-label="Clear search"
            data-testid="listings-search-clear"
            @click="search = ''"
          />
        </template>
      </UInput>
      <USelect
        v-model="sort"
        :items="SORT_OPTIONS"
        aria-label="Sort by"
        class="w-full md:w-48"
        data-testid="listings-sort"
      />
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-sliders-horizontal"
        class="justify-center"
        data-testid="listings-filters-toggle"
        @click="openSheet"
      >
        Filters
        <UBadge v-if="sheetCount" size="sm">{{ sheetCount }}</UBadge>
      </UButton>
      <UButton
        :color="facets.favorites ? 'warning' : 'neutral'"
        :variant="facets.favorites ? 'soft' : 'subtle'"
        :aria-pressed="facets.favorites"
        class="col-span-2 justify-center md:col-span-1"
        data-testid="listings-facet-favorites"
        @click="facets.favorites = !facets.favorites"
      >
        <!-- Filled when on, like ListingsFavoriteButton; see the comment there. -->
        <UIcon
          name="i-lucide-star"
          mode="svg"
          class="size-5"
          :class="{ '[&_*]:fill-current': facets.favorites }"
        />
        Favorites
      </UButton>
    </div>

    <div v-if="anyActive" class="flex flex-wrap items-center gap-2" data-testid="listings-active">
      <UButton
        v-for="chip in chips"
        :key="chip.key"
        color="neutral"
        variant="soft"
        size="sm"
        trailing-icon="i-lucide-x"
        :aria-label="`Remove filter ${chip.label}`"
        :data-testid="`listings-chip-${chip.key}`"
        @click="chip.clear"
        >{{ chip.label }}</UButton
      >
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        data-testid="listings-filters-clear"
        @click="clearAll"
        >Clear all</UButton
      >
    </div>

    <USlideover
      v-model:open="open"
      :side="side"
      title="Filters"
      description="Narrow the list. Changes apply right away."
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-y-3">
            <USwitch
              v-for="t in QUICK_TOGGLES"
              :key="t.key"
              v-model="facets[t.facet]"
              :data-testid="`listings-facet-${t.key}`"
            >
              <template #label>
                {{ t.label }}
                <span class="text-muted tabular-nums">{{ quickCounts[t.key] }}</span>
              </template>
            </USwitch>
          </div>
          <USeparator />
          <UFormField label="Status">
            <USelectMenu
              v-model="facets.statuses"
              :items="[...APPLICATION_STATUS_OPTIONS]"
              value-key="value"
              multiple
              placeholder="Any status"
              :search-input="false"
              class="w-full"
              data-testid="listings-facet-status"
            />
          </UFormField>
          <UFormField label="Skill">
            <ListingsFilterCombobox
              v-model="facets.skills"
              lookup="skills"
              placeholder="Any skill"
              data-testid="listings-facet-skill"
            />
          </UFormField>
          <UFormField label="Location">
            <ListingsFilterCombobox
              v-model="facets.locationIds"
              lookup="locations"
              placeholder="Any location"
              data-testid="listings-facet-location"
            />
          </UFormField>
          <UFormField label="Due">
            <USelect
              :model-value="facets.dueWithinDays ?? 0"
              :items="DUE_ITEMS"
              class="w-full"
              data-testid="listings-facet-due"
              @update:model-value="facets.dueWithinDays = $event || null"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Posted from">
              <UInput
                v-model="facets.postedFrom"
                type="date"
                :max="facets.postedTo || undefined"
                class="w-full"
                data-testid="listings-facet-postedFrom"
              />
            </UFormField>
            <UFormField label="Posted to">
              <UInput
                v-model="facets.postedTo"
                type="date"
                :min="facets.postedFrom || undefined"
                class="w-full"
                data-testid="listings-facet-postedTo"
              />
            </UFormField>
          </div>
          <UFormField label="Posting language">
            <USelectMenu
              v-model="facets.postingLanguages"
              :items="[...LANGUAGE_OPTIONS]"
              value-key="value"
              multiple
              placeholder="Any"
              :search-input="false"
              class="w-full"
              data-testid="listings-facet-postingLanguage"
            />
          </UFormField>
          <UFormField label="Required language">
            <USelectMenu
              v-model="facets.languages"
              :items="[...LANGUAGE_OPTIONS]"
              value-key="value"
              multiple
              placeholder="Any"
              :search-input="false"
              class="w-full"
              data-testid="listings-facet-requiredLanguage"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="!sheetCount"
            data-testid="listings-sheet-clear"
            @click="clearSheet"
            >Clear filters</UButton
          >
          <UButton data-testid="listings-sheet-done" @click="open = false">Done</UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
