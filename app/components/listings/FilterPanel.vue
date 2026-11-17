<script setup lang="ts">
import { useMediaQuery, useResizeObserver, useScroll } from '@vueuse/core'
import {
  LISTING_QUICK_PRESETS,
  type ListingQuickPreset,
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
  | 'shortlist'
  | 'norwayOnly'
  | 'itRoles'
  | 'nonItRoles'
  | 'englishPosting'
  | 'englishMentioned'
>
const PILLS: { key: string; facet: PillFacet; label: string; icon: string; count?: QuickToggle }[] =
  [
    { key: 'shortlist', facet: 'shortlist', label: 'Shortlist', icon: 'i-lucide-bookmark' },
    { key: 'favorites', facet: 'favorites', label: 'Favorites', icon: 'i-lucide-star' },
    {
      key: 'norway',
      facet: 'norwayOnly',
      label: 'Norway only',
      icon: 'i-lucide-map-pin',
      count: 'norway'
    },
    { key: 'it', facet: 'itRoles', label: 'IT roles', icon: 'i-lucide-code-xml', count: 'it' },
    {
      key: 'nonIt',
      facet: 'nonItRoles',
      label: 'Non-IT roles',
      icon: 'i-lucide-briefcase-business',
      count: 'nonIt'
    },
    {
      key: 'englishPosting',
      facet: 'englishPosting',
      label: 'English posting',
      icon: 'i-lucide-file-text',
      count: 'englishPosting'
    },
    {
      key: 'englishMentioned',
      facet: 'englishMentioned',
      label: 'English mentioned',
      icon: 'i-lucide-languages',
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

const presetIcons: Record<ListingQuickPreset, string> = {
  itIdeal: 'i-lucide-code-xml',
  genericLocal: 'i-lucide-map-pin',
  genericIdeal: 'i-lucide-briefcase-business',
  remote: 'i-lucide-globe'
}

const toggleQuickPreset = (preset: ListingQuickPreset) => {
  const active = facets.value.quickPreset === preset
  Object.assign(facets.value, {
    quickPreset: active ? null : preset,
    preferredLocations: false,
    norwayOnly: false,
    itRoles: false,
    nonItRoles: false,
    locationIds: []
  })
}

// The pills and the company (from a dashboard link) are set outside the sheet, so the Filters badge counts only
// what is inside it, and the sheet's own Clear leaves them alone. Clear all still resets every facet.
const outsideSheet = ({
  quickPreset,
  favorites,
  shortlist,
  companyId,
  preferredLocations,
  norwayOnly,
  itRoles,
  nonItRoles,
  englishPosting,
  englishMentioned
}: ListingsFacets) => ({
  quickPreset,
  favorites,
  shortlist,
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

// Keep the overflow hint only while more options remain to the right.
const quickFilters = useTemplateRef<HTMLElement>('quickFilters')
const quickPresets = useTemplateRef<HTMLElement>('quickPresets')
const filterScroll = useScroll(quickFilters, { observe: { mutation: true } })
const presetScroll = useScroll(quickPresets, { observe: { mutation: true } })
useResizeObserver([quickFilters, quickPresets], () => {
  filterScroll.measure()
  presetScroll.measure()
})

const open = ref(false)
const inlineFilters = useMediaQuery('(min-width: 96rem)')
// Resizing to the desktop sidebar dismisses an open sheet; narrowing again starts closed.
watch(inlineFilters, (inline) => {
  if (inline) open.value = false
})
</script>

<template>
  <!-- Search, individual quick filters, then combined quick presets. -->
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
        v-if="!inlineFilters"
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

    <section class="space-y-2" aria-labelledby="listing-filters-heading">
      <h3 id="listing-filters-heading" class="text-xs font-medium text-muted">Quick filters</h3>
      <div
        ref="quickFilters"
        class="quick-filter-row flex gap-1.5 overflow-x-auto md:grid md:grid-cols-3 md:overflow-visible 2xl:grid-cols-2"
        :class="{ 'has-more': !filterScroll.arrivedState.right }"
        role="group"
        aria-labelledby="listing-filters-heading"
      >
        <UButton
          v-for="p in PILLS"
          :key="p.key"
          :color="facets[p.facet] ? (p.facet === 'favorites' ? 'warning' : 'primary') : 'neutral'"
          :variant="facets[p.facet] ? 'soft' : 'subtle'"
          :aria-pressed="facets[p.facet]"
          class="w-auto min-w-0 shrink-0 justify-start whitespace-nowrap rounded-full md:w-full"
          :data-testid="`listings-facet-${p.key}`"
          @click="toggle(p.facet)"
        >
          <UIcon
            :name="p.icon"
            mode="svg"
            class="size-4 shrink-0"
            :class="{
              '[&_*]:fill-current':
                (p.facet === 'favorites' || p.facet === 'shortlist') && facets[p.facet]
            }"
            aria-hidden="true"
          />
          <UIcon
            v-if="p.facet !== 'favorites' && p.facet !== 'shortlist' && facets[p.facet]"
            name="i-lucide-check"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate text-left">{{ p.label }}</span>
          <span v-if="p.count" class="shrink-0 text-muted tabular-nums">{{
            quickCounts[p.count]
          }}</span>
        </UButton>
      </div>
    </section>

    <section class="space-y-2" aria-labelledby="listing-presets-heading">
      <h3 id="listing-presets-heading" class="text-xs font-medium text-muted">Quick presets</h3>
      <div
        ref="quickPresets"
        class="quick-filter-row flex gap-1.5 overflow-x-auto md:grid md:grid-cols-4 md:overflow-visible 2xl:grid-cols-2"
        :class="{ 'has-more': !presetScroll.arrivedState.right }"
        role="group"
        aria-labelledby="listing-presets-heading"
      >
        <UButton
          v-for="preset in LISTING_QUICK_PRESETS"
          :key="preset.value"
          :color="facets.quickPreset === preset.value ? 'primary' : 'neutral'"
          :variant="facets.quickPreset === preset.value ? 'soft' : 'subtle'"
          :aria-pressed="facets.quickPreset === preset.value"
          class="w-auto min-w-0 shrink-0 justify-start whitespace-nowrap rounded-full md:w-full"
          :data-testid="`listings-quick-${preset.value}`"
          @click="toggleQuickPreset(preset.value)"
        >
          <UIcon :name="presetIcons[preset.value]" class="size-4" aria-hidden="true" />
          <UIcon
            v-if="facets.quickPreset === preset.value"
            name="i-lucide-check"
            class="size-4"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate text-left">{{ preset.label }}</span>
        </UButton>
      </div>
    </section>

    <AppFilterChips
      v-if="anyActive"
      :chips="chips"
      testid-prefix="listings"
      @clear-all="clearAll"
    />

    <div
      v-if="inlineFilters"
      class="space-y-4 border-t border-default pt-4"
      data-testid="listings-inline-filters"
    >
      <ListingsFilterFields v-model:facets="facets" />
    </div>

    <AppFilterSheet
      v-else
      v-model:open="open"
      testid-prefix="listings"
      :clear-disabled="!sheetCount"
      @clear="clearSheet"
    >
      <ListingsFilterFields v-model:facets="facets" />
    </AppFilterSheet>
  </div>
</template>

<style scoped>
@media (width < 48rem) {
  .quick-filter-row {
    /* Leave room for focus outlines and for the final pill to clear the fade. */
    padding: 2px 1.5rem 2px 2px;
    scrollbar-width: none;
  }

  .quick-filter-row::-webkit-scrollbar {
    display: none;
  }

  .quick-filter-row.has-more {
    mask-image: linear-gradient(to right, black calc(100% - 1.5rem), transparent);
  }
}
</style>
