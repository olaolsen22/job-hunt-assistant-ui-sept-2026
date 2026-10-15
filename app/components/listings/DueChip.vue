<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

const { listing } = defineProps<{ listing: Pick<ListingListItem, 'deadlineType' | 'dueOn'> }>()

// Badges only take theme colors, so orange and yellow share warning; the label carries the days.
const COLORS = {
  red: 'error',
  orange: 'warning',
  yellow: 'warning',
  green: 'success',
  blue: 'info'
} as const

const summary = computed(() => dueSummary(listing))
</script>

<template>
  <UBadge
    :color="COLORS[deadlineLevel(summary.daysLeft)]"
    variant="subtle"
    :icon="summary.daysLeft < 0 ? 'i-lucide-calendar-x' : 'i-lucide-hourglass'"
    data-testid="listing-due"
  >
    <time :datetime="listing.dueOn" :title="`Due ${formatDate(listing.dueOn)}`">{{
      summary.label
    }}</time>
  </UBadge>
</template>
