<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useElementSize } from '@vueuse/core'
import type { ListingListItem, ListingsSort } from '~/composables/useListingsList'
import { LANGUAGE_FLAGS, languageLabel, type Language } from '~/constants/listing'

// Used when the results area has at least 48rem; narrower areas get ListingsRow instead.
// Sorting is server-side (the list is paginated), so a header click only changes `sort`.
const { listings, loading, skeletonRows } = defineProps<{
  listings: ListingListItem[]
  loading: boolean
  // Rows to fake while the first page loads, so the pager doesn't jump when data arrives.
  skeletonRows: number
}>()
const sort = defineModel<ListingsSort>('sort', { required: true })
defineEmits<{ changed: [] }>()

// Compact tables keep the title, dates, status and actions aligned in columns.
// Location gets a separate column only when it leaves enough room for the title.
const columns: TableColumn<ListingListItem>[] = [
  { id: 'favorite', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'title', header: 'Title' },
  { id: 'location', header: 'Location', meta: { class: { th: 'w-40', td: 'w-40' } } },
  { id: 'seniority', header: 'Seniority', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'languages', header: 'Language', meta: { class: { th: 'w-44', td: 'w-44' } } },
  { id: 'posted', header: 'Posted', meta: { class: { th: 'w-24', td: 'w-24' } } },
  { id: 'due', header: 'Due', meta: { class: { th: 'w-40', td: 'w-40' } } },
  { id: 'status', header: 'Status', meta: { class: { th: 'w-32', td: 'w-32' } } },
  { id: 'actions', meta: { class: { th: 'w-24', td: 'w-24' } } }
]

// Measure the table itself: both navigation and filters can reduce its available width.
// The ref is UTable's instance, so measure its root element.
const table = useTemplateRef('table')
const { width } = useElementSize(() => table.value?.$el)
// Language comes before Seniority: seniority falls back to the company line, language has no
// fallback. Language stays at 1168 so it shows on 1440/1920 screens with the sidebar (table
// ~1174px), at the cost of a ~260px title there; Seniority waits until Title is back to ~320px.
const wide = computed(() => width.value >= 1328)
const languaged = computed(() => width.value >= 1168)
const detailed = computed(() => width.value >= 1056)
const columnVisibility = computed(() => ({
  seniority: wide.value,
  languages: languaged.value,
  location: detailed.value
}))

const locationLabel = (listing: ListingListItem) =>
  listing.locations.map((l) => formatLocation(l.location)).join(', ') || 'Location not specified'

// Answers "is English OK here?": what the ad requires first, then the language it's written in
// (a Norwegian ad with no stated requirement is still a hint). Built once per listing so the cell
// doesn't refilter per binding; `label` is the full sentence for title and screen readers.
type LanguageLine = { language: Language; text: string; ad: boolean }
const languageSummaries = computed(
  () =>
    new Map(
      listings.map((listing) => {
        const required = listing.languages.filter((l) => l.isRequired)
        const ad = listing.postingLanguage
        const withLevel = (l: (typeof required)[number], sep: string) =>
          languageLabel(l.language) + (l.level ? `${sep}${l.level}` : '')
        // The ad language is marked on its requirement line instead of getting a second line.
        const lines: LanguageLine[] = required.map((l) => ({
          language: l.language,
          text: withLevel(l, ' ') + (l.language === ad ? ' · ad' : ''),
          ad: false
        }))
        if (ad && !required.some((l) => l.language === ad))
          lines.push({ language: ad, text: `Ad in ${languageLabel(ad)}`, ad: true })
        const label = [
          required.length &&
            `Requires ${required.map((l) => (l.level ? `${languageLabel(l.language)} (${l.level})` : languageLabel(l.language))).join(', ')}.`,
          ad && `Ad written in ${languageLabel(ad)}.`
        ]
          .filter(Boolean)
          .join(' ')
        return [listing.id, { lines, label }]
      })
    )
)

// First click picks the natural direction (A–Z, newest posted first), the second reverses it, the
// third goes back to the default due order. Due itself has no reverse: the server's due date isn't
// sortable, only its default order is (see ORDERS in useListingsList).
const SORTABLE = {
  title: { first: 'title-asc', second: 'title-desc', firstIcon: 'i-lucide-arrow-up-a-z' },
  seniority: { first: 'seniority-asc', second: 'seniority-desc', firstIcon: 'i-lucide-arrow-up' },
  posted: { first: 'posted', second: 'posted-asc', firstIcon: 'i-lucide-arrow-down' },
  due: { first: 'due', second: null, firstIcon: 'i-lucide-arrow-up' },
  status: { first: 'status-asc', second: 'status-desc', firstIcon: 'i-lucide-arrow-up' }
} as const satisfies Record<
  string,
  { first: ListingsSort; second: ListingsSort | null; firstIcon: string }
>
type SortableKey = keyof typeof SORTABLE
const sortableKeys = Object.keys(SORTABLE) as SortableKey[]

const REVERSED_ICON: Record<string, string> = {
  'i-lucide-arrow-up-a-z': 'i-lucide-arrow-down-z-a',
  'i-lucide-arrow-up': 'i-lucide-arrow-down',
  'i-lucide-arrow-down': 'i-lucide-arrow-up'
}

const headerState = (key: SortableKey) => {
  const { first, second, firstIcon } = SORTABLE[key]
  if (sort.value === first) return { active: true, icon: firstIcon }
  if (sort.value === second) return { active: true, icon: REVERSED_ICON[firstIcon] }
  return { active: false, icon: 'i-lucide-arrow-up-down' }
}

const nextSort = (key: SortableKey): ListingsSort => {
  const { first, second } = SORTABLE[key]
  if (sort.value === first) return second ?? first
  if (sort.value === second) return 'due'
  return first
}

const LABELS: Record<SortableKey, string> = {
  title: 'Title',
  seniority: 'Seniority',
  posted: 'Posted',
  due: 'Due',
  status: 'Status'
}
</script>

<template>
  <!-- table-fixed so the column widths hold and long titles clamp instead of pushing columns out.
       `relative` on the row anchors the title link's stretched ::after, so the whole row is a real
       link (middle-click, new tab) like the phone/tablet rows. -->
  <UTable
    ref="table"
    :data="listings"
    :columns="columns"
    :loading="loading"
    :column-visibility="columnVisibility"
    :ui="{
      base: 'w-full min-w-[48rem] table-fixed',
      tr: 'group relative hover:bg-elevated/50',
      th: 'px-3 py-2 text-xs font-medium uppercase text-muted',
      td: 'px-3'
    }"
    data-testid="listings-table"
  >
    <template v-for="key in sortableKeys" :key="key" #[`${key}-header`]>
      <UButton
        :label="LABELS[key]"
        :trailing-icon="headerState(key).icon"
        color="neutral"
        variant="ghost"
        size="xs"
        class="-mx-2 uppercase"
        :class="headerState(key).active ? 'text-highlighted' : 'text-muted'"
        :aria-label="`${LABELS[key]}${headerState(key).active ? ', sorted' : ''}. Change sort`"
        :data-testid="`listings-sort-${key}`"
        @click="sort = nextSort(key)"
      />
    </template>

    <template #favorite-cell="{ row }">
      <div class="flex items-center">
        <ListingsShortlistButton
          :id="row.original.id"
          :shortlisted-at="row.original.shortlistedAt"
          size="md"
          class="relative z-10"
          @changed="$emit('changed')"
        />
        <AppFavoriteButton
          :id="row.original.id"
          target="listing"
          :favorited-at="row.original.favoritedAt"
          size="md"
          class="relative z-10"
        />
      </div>
    </template>

    <template #title-cell="{ row }">
      <NuxtLink
        :to="`/listings/${row.original.id}`"
        class="line-clamp-2 font-semibold whitespace-normal wrap-anywhere text-highlighted group-hover:underline after:absolute after:inset-0"
        data-testid="listing-title"
        >{{ row.original.title }}</NuxtLink
      >
      <ListingsCompanyLine :listing="row.original" :with-seniority="!wide" truncate />
      <p
        v-if="!detailed"
        class="mt-1 truncate text-xs text-muted"
        :title="locationLabel(row.original)"
        data-testid="listing-location"
      >
        {{ locationLabel(row.original) }}
      </p>
    </template>

    <template #location-cell="{ row }">
      <p
        class="line-clamp-2 whitespace-normal wrap-break-word"
        :title="locationLabel(row.original)"
        data-testid="listing-location"
      >
        {{ locationLabel(row.original) }}
      </p>
    </template>

    <template #seniority-cell="{ row }">
      {{ listingSeniority(row.original) ?? '—' }}
    </template>

    <template #languages-cell="{ row }">
      <div
        v-if="languageSummaries.get(row.original.id)?.label"
        class="whitespace-normal"
        :title="languageSummaries.get(row.original.id)!.label"
        data-testid="listing-languages"
      >
        <!-- Screen readers get the one-sentence label below instead of the separate lines. -->
        <ul aria-hidden="true" data-testid="listing-languages-lines">
          <li
            v-for="line in languageSummaries.get(row.original.id)!.lines"
            :key="line.text"
            class="flex items-center gap-1.5"
            :class="{ 'text-toned': line.ad }"
            data-testid="listing-language-line"
          >
            <UIcon
              :name="LANGUAGE_FLAGS[line.language]"
              class="size-4 shrink-0"
              data-testid="listing-language-flag"
            />
            <span class="min-w-0">{{ line.text }}</span>
          </li>
        </ul>
        <span class="sr-only">{{ languageSummaries.get(row.original.id)!.label }}</span>
      </div>
      <span v-else data-testid="listing-languages">—</span>
    </template>

    <template #posted-cell="{ row }">
      <!-- z-10 keeps the date tooltips reachable above the stretched link. -->
      <ListingsPostedBadge
        v-if="row.original.postedOn"
        :posted-on="row.original.postedOn"
        compact
        class="relative z-10"
      />
    </template>

    <template #due-cell="{ row }">
      <ListingsDueChip :listing="row.original" class="relative z-10" />
    </template>

    <template #status-cell="{ row }">
      <div class="flex flex-col items-start gap-1">
        <ListingsStatusBadge :status="row.original.status" />
        <ListingsAnalyzedBadge v-if="!row.original.analyzedAt" :analyzed-at="null" />
      </div>
    </template>

    <template #actions-cell="{ row }">
      <ListingsRowActions
        :listing="row.original"
        class="relative z-10"
        @changed="$emit('changed')"
      />
    </template>

    <!-- Shown instead of the body while the first page loads; later loads keep the old rows. -->
    <template v-if="!listings.length" #loading>
      <div class="space-y-3 text-left">
        <USkeleton v-for="i in skeletonRows" :key="i" class="h-10 w-full" />
      </div>
    </template>
  </UTable>
</template>
