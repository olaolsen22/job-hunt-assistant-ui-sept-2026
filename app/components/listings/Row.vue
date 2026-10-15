<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'
import { SENIORITY_OPTIONS } from '~/constants/listing'

const { listing } = defineProps<{ listing: ListingListItem }>()
const emit = defineEmits<{ changed: [] }>()

const SET_ARCHIVED = graphql(`
  mutation SetListingArchivedFromList($input: SetListingArchivedInput!) {
    setListingArchived(input: $input) {
      listing {
        id
        archivedAt
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const toast = useToast()
const { run, loading: archiving } = useMutation(() => emit('changed'))

// The row leaves the current view, so the toast offers Undo (the reverse call).
const setArchived = async (isArchived: boolean) => {
  const ok = await run(async () => {
    const { setListingArchived } = await gql(SET_ARCHIVED, {
      input: { id: listing.id, isArchived }
    })
    return setListingArchived.errors
  })
  if (!ok) return
  emit('changed')
  toast.add({
    title: isArchived ? 'Archived' : 'Unarchived',
    color: 'success',
    actions: [
      {
        label: 'Undo',
        color: 'neutral',
        variant: 'outline',
        onClick: () => setArchived(!isArchived)
      }
    ]
  })
}

const firstLocation = computed(() => {
  const [first] = listing.locations
  return first ? formatLocation(first.location) : 'Location not specified'
})
const moreLocations = computed(() => Math.max(0, listing.locations.length - 1))

const seniority = computed(
  () => SENIORITY_OPTIONS.find((o) => o.value === listing.seniority)?.label ?? null
)

const daysSincePosted = computed(() => -daysFromToday(listing.postedOn))
const postedLabel = computed(() =>
  daysSincePosted.value <= 0 ? 'Today' : `${daysSincePosted.value}d ago`
)
</script>

<template>
  <!-- DOM order is the row order from md up; on phones `order-*` turns it into a small card led by
       the due date. The ::after on the title link stretches it over the item, so the item stays a
       real <a> (middle-click, new tab) while the star and ad link sit above it with z-10. -->
  <li
    class="group relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-default p-3 hover:bg-elevated/50 md:min-h-16 md:flex-nowrap md:gap-4 md:rounded-none md:border-0 md:px-4"
    data-testid="listing-row"
  >
    <ListingsFavoriteButton
      :id="listing.id"
      :favorited-at="listing.favoritedAt"
      size="md"
      class="relative z-10 order-2 ml-auto md:order-1 md:ml-0"
    />

    <div class="order-3 w-full min-w-0 md:order-2 md:w-auto md:flex-1">
      <h3 class="font-semibold text-highlighted md:line-clamp-1">
        <NuxtLink
          :to="`/listings/${listing.id}`"
          class="group-hover:underline after:absolute after:inset-0"
          >{{ listing.title }}</NuxtLink
        >
      </h3>
      <p class="text-sm text-muted md:truncate">
        {{ listing.company.name }} · {{ listing.jobRole.name }}
        <!-- Location and seniority get their own columns from lg. -->
        <span class="lg:hidden">
          · {{ firstLocation }}<template v-if="moreLocations"> +{{ moreLocations }}</template>
          <template v-if="seniority"> · {{ seniority }}</template>
        </span>
        <!-- Inline, not a badge: a third badge would wrap the status cell and break the row height. -->
        <span
          v-if="listing.company.avoidedAt"
          class="ml-1 inline-flex items-center gap-1 text-warning"
          data-testid="company-avoided"
          ><UIcon name="i-lucide-ban" class="size-3.5" />Avoided company</span
        >
      </p>
    </div>

    <p
      class="hidden w-40 shrink-0 text-sm text-muted lg:order-3 lg:block lg:truncate"
      data-testid="listing-location"
    >
      {{ firstLocation }}
      <span v-if="moreLocations" class="text-dimmed">+{{ moreLocations }}</span>
    </p>
    <p class="hidden w-16 shrink-0 text-sm text-muted lg:order-4 lg:block">
      {{ seniority ?? '—' }}
    </p>
    <time
      :datetime="listing.postedOn"
      :title="`Posted ${formatDate(listing.postedOn)}`"
      class="relative z-10 hidden w-16 shrink-0 text-sm lg:order-5 lg:block"
      :class="URGENCY_TEXT[postedLevel(daysSincePosted)]"
      data-testid="listing-posted"
      >{{ postedLabel }}</time
    >

    <!-- z-10 keeps the date tooltips reachable above the stretched link. Fixed widths only from lg,
         so the title keeps room on tablets. -->
    <div class="relative z-10 order-1 md:order-6 md:shrink-0 lg:w-44">
      <ListingsDueChip :listing="listing" />
    </div>

    <div class="order-4 flex flex-wrap gap-1 md:order-7 md:shrink-0 md:flex-nowrap lg:w-52">
      <ListingsStatusBadge :status="listing.status" />
      <ListingsAnalyzedBadge v-if="!listing.analyzedAt" :analyzed-at="null" />
    </div>

    <div class="relative z-10 order-5 ml-auto flex gap-1 md:order-8 md:ml-0 md:shrink-0">
      <UButton
        variant="ghost"
        color="neutral"
        :icon="listing.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
        :aria-label="`${listing.archivedAt ? 'Unarchive' : 'Archive'} ${listing.title}`"
        :loading="archiving"
        data-testid="listing-archive"
        @click="setArchived(!listing.archivedAt)"
      />
      <UButton
        :to="listing.url"
        target="_blank"
        rel="noopener"
        variant="ghost"
        color="neutral"
        icon="i-lucide-external-link"
        :aria-label="`View ad for ${listing.title}`"
        data-testid="listing-view-ad"
      />
    </div>
  </li>
</template>
