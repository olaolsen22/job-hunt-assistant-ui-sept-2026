<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

const { listing } = defineProps<{ listing: Pick<ListingListItem, 'deadlineType' | 'dueOn'> }>()

const summary = computed(() => dueSummary(listing))
</script>

<template>
  <UBadge
    v-if="summary && listing.dueOn"
    :color="URGENCY_BADGE_COLOR[deadlineLevel(summary.daysLeft)]"
    variant="subtle"
    :icon="summary.daysLeft < 0 ? 'i-lucide-calendar-x' : 'i-lucide-hourglass'"
    data-testid="listing-due"
  >
    <time :datetime="listing.dueOn" :title="`Due ${formatDate(listing.dueOn)}`">{{
      summary.label
    }}</time>
  </UBadge>
</template>
