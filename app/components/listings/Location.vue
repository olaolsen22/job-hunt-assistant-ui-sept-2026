<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'
import { COUNTRY_OPTIONS } from '~/constants/countries'

const { listing } = defineProps<{ listing: Pick<ListingListItem, 'locations'> }>()

const countryNames = new Map(COUNTRY_OPTIONS.map((option) => [option.value, option.label]))

const locationLabel = computed(() => {
  const labels = listing.locations.map(({ location }) => {
    const country = countryNames.get(location.countryCode) ?? location.countryCode
    return location.city ? `${location.city}, ${country}` : country
  })
  return labels.length > 0 ? labels.join(' | ') : 'Location not specified'
})
</script>

<template>
  <p class="flex items-center gap-1.5 text-sm text-muted">
    <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
    {{ locationLabel }}
  </p>
</template>
