<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'
import { COUNTRY_OPTIONS } from '~/constants/countries'

const { listing } = defineProps<{ listing: ListingListItem }>()

const countryNames = new Map(COUNTRY_OPTIONS.map((option) => [option.value, option.label]))

const locationLabel = computed(() => {
  const labels = listing.locations.map(({ location }) => {
    const country = countryNames.get(location.countryCode) ?? location.countryCode
    return location.city ? `${location.city}, ${country}` : country
  })
  return labels.length > 0 ? labels.join(' | ') : 'Location not specified'
})

const deadlineLabel = computed(() => {
  switch (listing.deadlineType) {
    case 'DATE':
      return listing.deadlineOn ? formatDate(listing.deadlineOn) : 'No deadline stated'
    case 'ASAP':
      return 'ASAP'
    case 'ROLLING':
      return 'Rolling'
    default:
      return 'No deadline stated'
  }
})
</script>

<template>
  <UCard data-testid="listing-card">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <h3 class="font-semibold text-highlighted">{{ listing.title }}</h3>

        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
          {{ listing.company.name }}
        </p>

        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
            {{ locationLabel }}
          </span>
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
            {{ listing.postedOn ? formatDate(listing.postedOn) : 'Posted date unknown' }}
          </span>
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-hourglass" class="size-4 shrink-0" />
            {{ deadlineLabel }}
          </span>
        </div>
      </div>

      <UButton
        :to="listing.url"
        target="_blank"
        rel="noopener"
        variant="ghost"
        color="neutral"
        icon="i-lucide-external-link"
        class="shrink-0"
        aria-label="View posting"
      />
    </div>
  </UCard>
</template>
