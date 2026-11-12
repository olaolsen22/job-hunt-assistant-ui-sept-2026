<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'

const { listing } = defineProps<{
  listing: Pick<
    ListingOverview,
    'createdAt' | 'updatedAt' | 'analyzedAt' | 'reanalyzedAt' | 'statusChangedAt'
  >
}>()

const dates = computed(() =>
  [
    { label: 'Created', value: listing.createdAt },
    { label: 'Updated', value: listing.updatedAt },
    { label: 'Analyzed', value: listing.reanalyzedAt ?? listing.analyzedAt },
    { label: 'Status changed', value: listing.statusChangedAt }
  ].filter((d): d is { label: string; value: string } => !!d.value)
)
</script>

<template>
  <p class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" data-testid="overview-record-dates">
    <span v-for="d in dates" :key="d.label">{{ d.label }} {{ formatDateTime(d.value) }}</span>
  </p>
</template>
