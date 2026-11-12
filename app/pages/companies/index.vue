<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import {
  COMPANY_SORTS,
  COMPANY_TABS,
  companyKindLabel,
  companySizeRange
} from '~/constants/company'

definePageMeta({ title: 'Companies' })

const grid = useTemplateRef('grid')
const {
  search,
  settledSearch,
  tab,
  sort,
  facets,
  page,
  pageSize,
  companies,
  totalCount,
  loading,
  error,
  goTo,
  clearAll
} = useCompaniesList(grid)

const tabInfo = computed(() => COMPANY_TABS.find((t) => t.value === tab.value)!)
const tabItems = COMPANY_TABS.map(({ label, value, icon }) => ({ label, value, icon }))
const sortItems = COMPANY_SORTS.map(({ label, value }) => ({ label, value }))
// Anything that can make an empty list mean "no match" rather than "nothing yet".
const narrowed = computed(() => !!settledSearch.value || countActiveCompaniesFacets(facets) > 0)
const emptyText = computed(() =>
  narrowed.value ? 'No companies match.' : `No ${tabInfo.value.noun[1]} yet.`
)

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Selected companies (id → name) are kept across searches and pages, so the count in the bar can
// include ones that are no longer listed. One AI reply has to cover them all, hence the cap.
const MAX_SELECTED = 20
const selected = ref(new Map<number, string>())
useToastClearance(useTemplateRef('selection-bar'))
const selectionNotice = ref('')

const setSelected = (c: { id: number; name: string }, on: boolean) => {
  if (!on) {
    selected.value.delete(c.id)
    selectionNotice.value = ''
  } else if (selected.value.size >= MAX_SELECTED) {
    selectionNotice.value = `You can research up to ${MAX_SELECTED} companies at once.`
  } else selected.value.set(c.id, c.name)
}

const allShownSelected = computed(
  () => companies.value.length > 0 && companies.value.every((c) => selected.value.has(c.id))
)
const selectAllState = computed(() =>
  allShownSelected.value
    ? true
    : companies.value.some((c) => selected.value.has(c.id))
      ? 'indeterminate'
      : false
)
const toggleAllShown = () => companies.value.forEach((c) => setSelected(c, !allShownSelected.value))

const clearSelection = () => {
  selected.value.clear()
  selectionNotice.value = ''
}

// Handed to /companies/add, which opens its paste modal with them. State, not the URL, since 20
// names can make a long query string.
const researchNames = useState<string[]>('companiesResearchNames', () => [])
const researchSelected = () => {
  researchNames.value = [...selected.value.values()]
  return navigateTo('/companies/add')
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-4">
        <p class="text-lg font-semibold text-highlighted" data-testid="companies-total">
          <template v-if="loading && !companies.length">&nbsp;</template>
          <template v-else>{{ totalCount }} {{ tabInfo.noun[totalCount === 1 ? 0 : 1] }}</template>
        </p>
        <UCheckbox
          v-if="companies.length"
          :model-value="selectAllState"
          :disabled="loading"
          label="Select all shown"
          data-testid="companies-select-all"
          @update:model-value="toggleAllShown"
        />
      </div>
      <UButton
        to="/companies/add"
        icon="i-lucide-plus"
        class="shrink-0"
        data-testid="companies-add"
      >
        <span class="max-sm:sr-only">Add companies</span>
      </UButton>
    </div>

    <!-- Type and sort: pill tabs from md, two equal selects on phones where three tabs squash. -->
    <div class="flex items-center gap-2">
      <UTabs
        v-model="tab"
        :items="tabItems"
        :content="false"
        variant="pill"
        size="sm"
        aria-label="Company type"
        class="hidden md:block"
        data-testid="companies-tabs"
      />
      <USelect
        v-model="tab"
        :items="tabItems"
        aria-label="Company type"
        class="min-w-0 flex-1 md:hidden"
        data-testid="companies-tab-select"
      />
      <USelect
        v-model="sort"
        :items="sortItems"
        aria-label="Sort"
        class="min-w-0 flex-1 md:ml-auto md:w-52 md:flex-none"
        data-testid="companies-sort"
      />
    </div>
    <p v-if="tab === 'employers'" class="-mt-4 text-sm text-muted" data-testid="companies-tab-hint">
      Companies without a type yet are under All.
    </p>

    <CompaniesFilterPanel v-model:facets="facets" v-model:search="search" />

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div
      v-else-if="!loading && companies.length === 0"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="companies-empty"
    >
      <UIcon :name="tabInfo.icon" class="size-10 text-muted" />
      <p>{{ emptyText }}</p>
      <UButton
        v-if="narrowed"
        color="neutral"
        variant="subtle"
        data-testid="companies-empty-clear"
        @click="clearAll"
        >Clear search and filters</UButton
      >
      <UButton v-else-if="tab === 'all'" to="/companies/add">Add companies</UButton>
    </div>

    <template v-else>
      <!-- Rows from the previous tab or filters stay until the new ones arrive; dimmed and inert, so
           Select all can't act on rows that are about to go. -->
      <div
        ref="grid"
        class="grid gap-3 transition-opacity"
        :class="{ 'pointer-events-none opacity-50': loading && companies.length }"
        :aria-busy="loading"
        data-testid="companies-list"
      >
        <template v-if="loading && companies.length === 0">
          <USkeleton v-for="i in pageSize" :key="i" class="h-20 w-full lg:h-16" />
        </template>
        <UCard
          v-for="c in companies"
          v-else
          :key="c.id"
          class="relative transition hover:bg-elevated"
          data-testid="companies-row"
        >
          <div class="flex items-center gap-3">
            <!-- Above the card's overlay link (like the favorite button); the padding is the touch area. -->
            <div class="relative z-10 -m-2.5 shrink-0 p-2.5">
              <UCheckbox
                :model-value="selected.has(c.id)"
                :aria-label="`Select ${c.name}`"
                data-testid="companies-row-select"
                @update:model-value="setSelected(c, $event === true)"
              />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-6">
              <div class="min-w-0 lg:flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <!-- The ::after overlay stretches the link over the card (like ListingsRow), so the
                     favorite button isn't nested inside an <a>. -->
                  <NuxtLink
                    :to="`/companies/${c.id}`"
                    class="truncate font-medium text-highlighted after:absolute after:inset-0"
                    data-testid="companies-row-link"
                    >{{ c.name }}</NuxtLink
                  >
                  <!-- The tab already says "consultancy"; an untyped company hasn't been researched. -->
                  <UBadge
                    v-if="tab !== 'consultancies'"
                    :color="c.kind ? 'primary' : 'neutral'"
                    :variant="c.kind ? 'subtle' : 'outline'"
                    size="sm"
                    class="shrink-0"
                    data-testid="companies-row-kind"
                    >{{ c.kind ? companyKindLabel(c.kind) : 'Not researched' }}</UBadge
                  >
                </div>
                <!-- Size first, so truncation cuts the industry name rather than the size. -->
                <p
                  v-if="c.industry || c.sizeBand"
                  class="truncate text-sm text-muted"
                  data-testid="companies-row-industry"
                >
                  {{ [companySizeRange(c.sizeBand), c.industry?.name].filter(Boolean).join(' · ') }}
                </p>
              </div>
              <p
                v-if="c.locations.length"
                class="flex min-w-0 items-center gap-1 text-sm text-muted lg:flex-1"
              >
                <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
                <span class="truncate">{{ formatPlaces(c.locations.map((l) => l.location)) }}</span>
              </p>
              <div class="flex shrink-0 flex-wrap items-center gap-2">
                <CompaniesAvoidedBadge v-if="c.avoidedAt" />
                <AppFavoriteButton
                  :id="c.id"
                  target="company"
                  :favorited-at="c.favoritedAt"
                  class="relative z-10"
                />
                <!-- Listings always show, so "0 listings" says there is nothing open there yet;
                     the other counts only when they have something. -->
                <UBadge
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-briefcase"
                  data-testid="companies-row-listings"
                  >{{ plural(c.listingCount, 'listing') }}</UBadge
                >
                <UBadge
                  v-if="c.applicationCount"
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-send"
                  data-testid="companies-row-applications"
                  >{{ plural(c.applicationCount, 'application') }}</UBadge
                >
                <UBadge
                  v-if="c.contacts.length"
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-contact-round"
                  data-testid="companies-row-contacts"
                  >{{ plural(c.contacts.length, 'contact') }}</UBadge
                >
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- UPagination still renders a lone "1" with disabled arrows when everything fits on one page. -->
      <div v-if="totalCount > pageSize" class="flex justify-center sm:justify-end">
        <UPagination
          :page="page"
          :total="totalCount"
          :items-per-page="pageSize"
          :disabled="loading"
          data-testid="companies-pagination"
          @update:page="goTo"
        />
      </div>
    </template>

    <!-- Sticky at the end of the content, so it sits at the bottom of the screen without covering
         the last row. -->
    <div
      v-if="selected.size"
      ref="selection-bar"
      class="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-default bg-default p-3 shadow-lg"
      data-testid="companies-selection-bar"
    >
      <p class="text-sm font-medium text-highlighted">{{ selected.size }} selected</p>
      <p v-if="selectionNotice" class="text-sm text-warning">{{ selectionNotice }}</p>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          data-testid="companies-selection-clear"
          @click="clearSelection"
          >Clear</UButton
        >
        <UButton
          icon="i-lucide-sparkles"
          data-testid="companies-research-selected"
          @click="researchSelected"
          >Research selected</UButton
        >
      </div>
    </div>
  </div>
</template>
