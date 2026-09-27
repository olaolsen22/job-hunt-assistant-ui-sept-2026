<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'
import { APPLICATION_STATUS_OPTIONS } from '~/constants/listing'

const { status } = defineProps<{ status: ListingDetail['status'] }>()

const option = computed(() => APPLICATION_STATUS_OPTIONS.find((o) => o.value === status)!)
</script>

<template>
  <!-- Withdrawn shares Saved's neutral color (it was the user's choice, not an error), so the
       outline variant tells them apart. -->
  <UBadge
    :color="option.color"
    :variant="status === 'WITHDRAWN' ? 'outline' : 'subtle'"
    data-testid="listing-status"
    >{{ option.label }}</UBadge
  >
</template>
