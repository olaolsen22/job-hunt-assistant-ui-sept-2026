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

// An unsolicited application has no posting date, so no posted badge.
const posted = computed(() => {
  if (!listing.postedOn) return null
  const days = -daysFromToday(listing.postedOn)
  return { on: listing.postedOn, days, label: days <= 0 ? 'Today' : `${days}d ago` }
})
</script>

<template>
  <!-- Below lg the status badges sit inline after the title text (so they follow its last
       character when it wraps), and due + posted share the last line. Phones: a small card.
       md to lg: two lines (star, title, actions, then meta and dates). lg+: aligned columns under
       the header in the list page (status moves to its own column); keep the widths in sync
       with it. Nothing is hidden at any width.
       The ::after on the title link stretches it over the item, so the item stays a real <a>
       (middle-click, new tab) while the star and ad link sit above it with z-10. -->
  <li
    class="group relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-default p-3 hover:bg-elevated/50 md:gap-x-4 md:gap-y-1 md:rounded-none md:border-0 md:px-4 lg:min-h-16 lg:flex-nowrap"
    data-testid="listing-row"
  >
    <AppFavoriteButton
      :id="listing.id"
      target="listing"
      :favorited-at="listing.favoritedAt"
      size="md"
      class="relative z-10 order-2 md:order-1 lg:w-8 lg:shrink-0"
    />

    <div class="order-1 min-w-0 flex-1 align-middle md:order-2 md:min-w-48">
      <h3 class="font-semibold text-highlighted lg:line-clamp-2">
        <NuxtLink
          :to="`/listings/${listing.id}`"
          class="group-hover:underline after:absolute after:inset-0"
          >{{ listing.title }}</NuxtLink
        >
        <!-- lg+ shows the same badges in the Status column instead. -->
        <span class="ml-1 inline-flex flex-wrap gap-1 align-middle lg:hidden">
          <ListingsStatusBadge :status="listing.status" />
          <ListingsAnalyzedBadge v-if="!listing.analyzedAt" :analyzed-at="null" />
        </span>
      </h3>
      <p class="text-sm text-muted lg:truncate">
        {{ listing.company.name }} · {{ listing.jobRole.name }}
        <!-- Inline, not a badge: a third badge would wrap the status cell and break the row height. -->
        <span
          v-if="listing.company.avoidedAt"
          class="ml-1 inline-flex items-center gap-1 text-warning"
          data-testid="company-avoided"
          ><UIcon name="i-lucide-ban" class="size-3.5" />Avoided company</span
        >
      </p>
    </div>

    <!-- Forces the md-lg second line; the title above is free to take the whole first line. -->
    <div class="order-4 hidden basis-full md:block lg:hidden" aria-hidden="true" />

    <!-- Meta wraps as one line below lg; at lg `contents` hands each field to the row as a column. -->
    <div
      class="order-3 flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted md:order-5 md:w-auto lg:contents"
    >
      <p class="lg:order-3 lg:w-40 lg:shrink-0 lg:truncate" data-testid="listing-location">
        {{ firstLocation }}
        <span v-if="moreLocations" class="text-dimmed">+{{ moreLocations }}</span>
      </p>
      <span v-if="seniority" class="lg:hidden" aria-hidden="true">·</span>
      <p :class="seniority ? '' : 'max-lg:hidden'" class="lg:order-4 lg:w-16 lg:shrink-0">
        {{ seniority ?? '—' }}
      </p>
    </div>

    <!-- Due + posted: the last line below lg; `contents` hands them to the row as columns at lg. -->
    <div class="order-4 flex items-center gap-2 md:order-6 lg:contents">
      <!-- z-10 keeps the date tooltips reachable above the stretched link. -->
      <div class="relative z-10 lg:order-6 lg:w-44 lg:shrink-0">
        <ListingsDueChip :listing="listing" />
      </div>
      <!-- Wrapper keeps the badge from stretching in its fixed-width column. -->
      <div class="relative z-10 lg:order-5 lg:w-20 lg:shrink-0">
        <UBadge
          v-if="posted"
          :color="URGENCY_BADGE_COLOR[postedLevel(posted.days)]"
          variant="subtle"
          data-testid="listing-posted"
        >
          <UIcon name="i-lucide-calendar-plus" class="size-4 shrink-0 lg:hidden" />
          <time :datetime="posted.on" :title="`Posted ${formatDate(posted.on)}`"
            ><span class="lg:hidden">Posted </span>{{ posted.label }}</time
          >
        </UBadge>
      </div>
    </div>

    <div class="hidden lg:order-7 lg:flex lg:w-52 lg:shrink-0 lg:gap-1">
      <ListingsStatusBadge :status="listing.status" />
      <ListingsAnalyzedBadge v-if="!listing.analyzedAt" :analyzed-at="null" />
    </div>

    <div
      class="relative z-10 order-5 ml-auto flex gap-1 md:order-3 md:ml-0 lg:order-8 lg:w-17 lg:shrink-0"
    >
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
        v-if="listing.url"
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
