<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

const { listing } = defineProps<{ listing: Pick<ListingListItem, 'locations'> }>()

const locationLabel = computed(() => {
  const labels = listing.locations.map(({ location }) => formatLocation(location))
  return labels.length > 0 ? labels.join(' | ') : 'Location not specified'
})
</script>

<template>
  <p class="flex items-center gap-1.5 text-sm text-muted">
    <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
    {{ locationLabel }}
  </p>
</template>
