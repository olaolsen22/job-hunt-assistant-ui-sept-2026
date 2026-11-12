<script setup lang="ts">
import {
  DUE_WITHIN_OPTIONS,
  type ListingsFacets,
  type QuickToggle
} from '~/composables/useListingsList'
import { APPLICATION_STATUS_OPTIONS, LANGUAGE_OPTIONS } from '~/constants/listing'

const facets = defineModel<ListingsFacets>('facets', { required: true })
const search = defineModel<string>('search', { required: true })
// The company filter holds an id; the page knows the name from the listings it shows.
// Quick counts tell how many listings each switch would leave under the active preset.
const { companyName = '', quickCounts } = defineProps<{
  companyName?: string
  quickCounts: Record<QuickToggle, number>
}>()

// One pill per quick filter, always visible. Favorites has no count; the others show how many
// listings they would leave under the active preset, facets and search.
type PillFacet = Extract<
  keyof ListingsFacets,
  | 'favorites'
  | 'preferredLocations'
  | 'norwayOnly'
  | 'itRoles'
  | 'nonItRoles'
  | 'englishPosting'
  | 'englishMentioned'
>
const PILLS: { key: string; facet: PillFacet; label: string; count?: QuickToggle }[] = [
  { key: 'favorites', facet: 'favorites', label: 'Favorites' },
  {
    key: 'preferred',
    facet: 'preferredLocations',
    label: 'Preferred locations',
    count: 'preferred'
  },
  {
    key: 'norway',
    facet: 'norwayOnly',
    label: 'Norway only',
    count: 'norway'
  },
  { key: 'it', facet: 'itRoles', label: 'IT roles', count: 'it' },
  {
    key: 'nonIt',
    facet: 'nonItRoles',
    label: 'Non-IT roles',
    count: 'nonIt'
  },
  {
    key: 'englishPosting',
    facet: 'englishPosting',
    label: 'English posting',
    count: 'englishPosting'
  },
  {
    key: 'englishMentioned',
    facet: 'englishMentioned',
    label: 'English mentioned',
    count: 'englishMentioned'
  }
]

// IT and non-IT together would always be empty, so turning one on turns the other off.
const EXCLUSIVE: Partial<Record<PillFacet, PillFacet>> = {
  itRoles: 'nonItRoles',
  nonItRoles: 'itRoles'
}
const toggle = (facet: PillFacet) => {
  facets.value[facet] = !facets.value[facet]
  const other = EXCLUSIVE[facet]
  if (other && facets.value[facet]) facets.value[other] = false
}

// USelect can't hold null, so "Any" is a sentinel that maps back to null.
const DUE_ITEMS = [
  { label: 'Due: any time', value: 0 },
  ...DUE_WITHIN_OPTIONS.map((days) => ({ label: `Due within ${days} days`, value: days }))
]

// The pills and the company (from a dashboard link) are set outside the sheet, so the Filters badge counts only
// what is inside it, and the sheet's own Clear leaves them alone. Clear all still resets every facet.
const outsideSheet = ({
  favorites,
  companyId,
  preferredLocations,
  norwayOnly,
  itRoles,
  nonItRoles,
  englishPosting,
  englishMentioned
}: ListingsFacets) => ({
  favorites,
  companyId,
  preferredLocations,
  norwayOnly,
  itRoles,
  nonItRoles,
  englishPosting,
  englishMentioned
})
const sheetCount = computed(() =>
  countActiveFacets({ ...facets.value, ...outsideSheet(emptyFacets()) })
)
const anyActive = computed(() => countActiveFacets(facets.value) > 0)

const labels = (options: readonly { label: string; value: string }[], values: string[]) =>
  values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')

// One removable chip per facet in the sheet, plus the company (the pills show their own state), so a deep link or a forgotten filter stays visible.
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
    },
    f.showRejected && {
      key: 'rejected',
      label: 'Rejected shown',
      clear: () => (f.showRejected = false)
    }
  ].filter((chip) => !!chip)
})

const clearAll = () => Object.assign(facets.value, emptyFacets())
const clearSheet = () => Object.assign(facets.value, emptyFacets(), outsideSheet(facets.value))

const open = ref(false)
</script>

<template>
  <!-- Two rows: search + Filters share one (so Filters lines up with Sort above), then the quick
       filter pills. Phones scroll the pills in one line, since wrapping seven would take four rows. -->
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search listings"
        aria-label="Search title, company or role"
        class="min-w-0 flex-1"
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
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-sliders-horizontal"
        class="shrink-0"
        data-testid="listings-filters-toggle"
        @click="open = true"
      >
        Filters
        <UBadge v-if="sheetCount" size="sm">{{ sheetCount }}</UBadge>
      </UButton>
    </div>

    <div class="flex items-start gap-2">
      <span class="hidden shrink-0 pt-2 text-xs text-muted 2xl:block">Quick filters</span>
      <!-- The right fade hints that more pills scroll in; the end padding matches its width, so the
           last pill clears the fade once scrolled to the end. -->
      <div
        class="flex min-w-0 gap-1.5 overflow-x-auto pr-8 pb-1 mask-r-from-[calc(100%-2rem)] md:flex-wrap md:overflow-visible md:pr-0 md:pb-0 md:mask-none"
        role="group"
        aria-label="Quick filters"
      >
        <UButton
          v-for="p in PILLS"
          :key="p.key"
          :color="facets[p.facet] ? (p.facet === 'favorites' ? 'warning' : 'primary') : 'neutral'"
          :variant="facets[p.facet] ? 'soft' : 'subtle'"
          :aria-pressed="facets[p.facet]"
          class="shrink-0 rounded-full whitespace-nowrap"
          :data-testid="`listings-facet-${p.key}`"
          @click="toggle(p.facet)"
        >
          <!-- A check when on (a second cue besides colour); Favorites shows its star, filled when on,
               like ListingsFavoriteButton. Idle pills carry no icon, which keeps all seven on one
               line from xl. -->
          <UIcon
            v-if="p.facet === 'favorites'"
            name="i-lucide-star"
            mode="svg"
            class="size-4"
            :class="{ '[&_*]:fill-current': facets.favorites }"
          />
          <UIcon v-else-if="facets[p.facet]" name="i-lucide-check" class="size-4" />
          {{ p.label }}
          <span v-if="p.count" class="text-muted tabular-nums">{{ quickCounts[p.count] }}</span>
        </UButton>
      </div>
    </div>

    <AppFilterChips
      v-if="anyActive"
      :chips="chips"
      testid-prefix="listings"
      @clear-all="clearAll"
    />

    <AppFilterSheet
      v-model:open="open"
      testid-prefix="listings"
      :clear-disabled="!sheetCount"
      @clear="clearSheet"
    >
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">Status</h3>
        <USelectMenu
          v-model="facets.statuses"
          :items="[...APPLICATION_STATUS_OPTIONS]"
          value-key="value"
          multiple
          placeholder="Any status"
          :search-input="false"
          class="w-full"
          aria-label="Status"
          data-testid="listings-facet-status"
        />
        <USwitch
          v-model="facets.showRejected"
          label="Show rejected applications"
          description="Picking statuses above always shows exactly those."
          data-testid="listings-facet-rejected"
        />
      </section>
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">Location</h3>
        <AppFilterCombobox
          v-model="facets.locationIds"
          lookup="locations"
          placeholder="Any location"
          data-testid="listings-facet-location"
        />
      </section>
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">Language</h3>
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
      </section>
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">Skills</h3>
        <AppFilterCombobox
          v-model="facets.skills"
          lookup="skills"
          placeholder="Any skill"
          data-testid="listings-facet-skill"
        />
      </section>
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">Dates</h3>
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
      </section>
    </AppFilterSheet>
  </div>
</template>
