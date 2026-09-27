<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'
import { APPLICATION_STATUS_OPTIONS } from '~/constants/listing'

const { status, prominent } = defineProps<{
  status: ListingDetail['status']
  // The detail page shows it as the card's headline; list cards keep it small and quiet.
  prominent?: boolean
}>()

const option = computed(() => APPLICATION_STATUS_OPTIONS.find((o) => o.value === status)!)
</script>

<template>
  <!-- Withdrawn shares Saved's neutral color (it was the user's choice, not an error), so the
       outline variant tells them apart. -->
  <UBadge
    :color="option.color"
    :variant="status === 'WITHDRAWN' ? 'outline' : prominent ? 'solid' : 'subtle'"
    :size="prominent ? 'lg' : 'md'"
    data-testid="listing-status"
    >{{ option.label }}</UBadge
  >
</template>
