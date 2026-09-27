<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'
import type { Outcome } from '~/constants/listing'

const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

// Which buttons to show; the API enforces the actual transition rules.
const outcomes = computed((): Outcome[] => {
  if (listing.status === 'APPLIED' || listing.status === 'INTERVIEWING')
    return ['OFFER', 'REJECTED', 'WITHDRAWN']
  if (listing.status === 'OFFER') return ['WITHDRAWN']
  return []
})
const appliedAt = computed(
  () => listing.statusHistory.find((e) => e.status === 'APPLIED')?.occurredAt
)

const applyOpen = ref(false)
const outcomeOpen = ref(false)
</script>

<template>
  <AppCard title="Application">
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <ListingsStatusBadge :status="listing.status" />
          <UBadge
            v-if="listing.archivedAt"
            color="neutral"
            variant="subtle"
            icon="i-lucide-archive"
            data-testid="listing-archived"
            >Archived</UBadge
          >
          <span
            v-if="listing.company.applicationCount"
            class="text-sm text-muted"
            data-testid="listing-application-count"
            >Applied to {{ listing.company.name }} {{ listing.company.applicationCount }}×</span
          >
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="listing.status === 'SAVED'"
            icon="i-lucide-send"
            data-testid="listing-apply"
            @click="applyOpen = true"
            >Apply</UButton
          >
          <UButton
            v-if="outcomes.length"
            color="neutral"
            variant="subtle"
            icon="i-lucide-flag"
            data-testid="listing-record-outcome"
            @click="outcomeOpen = true"
            >{{ listing.status === 'OFFER' ? 'Withdraw' : 'Record outcome' }}</UButton
          >
        </div>
      </div>

      <div
        v-if="listing.status !== 'SAVED' || listing.interviews.length"
        class="grid gap-6 lg:grid-cols-2"
      >
        <div class="space-y-3">
          <h3 class="font-medium text-highlighted">Timeline</h3>
          <ListingsStatusTimeline :listing="listing" @changed="emit('changed')" />
        </div>
        <ListingsInterviews :listing="listing" @changed="emit('changed')" />
      </div>
    </div>

    <ListingsApplyModal v-model:open="applyOpen" :listing="listing" @changed="emit('changed')" />
    <ListingsOutcomeModal
      v-model:open="outcomeOpen"
      :listing-id="listing.id"
      :outcomes="outcomes"
      :applied-at="appliedAt"
      @changed="emit('changed')"
    />
  </AppCard>
</template>
