<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'
import type { Outcome } from '~/constants/listing'

const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

// Which buttons to show; the API enforces the actual transition rules.
const outcomes = computed((): Outcome[] => {
  if (listing.status === 'APPLIED' || listing.status === 'INTERVIEWING')
    return ['OFFER', 'REJECTED', 'WITHDRAWN']
  if (listing.status === 'OFFER') return ['ACCEPTED', 'REJECTED', 'WITHDRAWN']
  return []
})
// From an offer, the API's REJECTED means the company withdrew it and WITHDRAWN means we declined.
const offerLabels = { ACCEPTED: 'Accepted', REJECTED: 'Offer withdrawn', WITHDRAWN: 'Declined' }
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
          <ListingsStatusBadge :status="listing.status" prominent />
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
            >Record outcome</UButton
          >
        </div>
      </div>

      <div
        v-if="listing.status !== 'SAVED' || listing.interviews.length"
        class="grid gap-6 border-t border-muted pt-6 lg:grid-cols-2"
      >
        <div class="space-y-3">
          <h3 class="font-medium text-highlighted">Timeline</h3>
          <ListingsStatusTimeline :listing="listing" @changed="emit('changed')" />
        </div>
        <!-- Stacked below lg, side by side from lg, so the divider flips from top to left.
             Wrapped: Interviews has multiple roots (its modals), so a class on it is dropped. -->
        <div class="border-t border-muted pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <ListingsInterviews :listing="listing" @changed="emit('changed')" />
        </div>
      </div>

      <div v-if="listing.documents.length" class="space-y-3 border-t border-muted pt-6">
        <h3 class="font-medium text-highlighted">Documents</h3>
        <ul class="space-y-1" data-testid="listing-documents">
          <li v-for="doc in listing.documents" :key="doc.id" class="flex items-center gap-2">
            <!-- `external` because /api/** is a proxied backend route, not a Nuxt page. -->
            <UButton
              :to="`/api/documents/${doc.id}`"
              external
              target="_blank"
              variant="link"
              size="sm"
              icon="i-lucide-file-text"
              class="min-w-0 p-0"
            >
              <span class="truncate">{{ doc.fileName }}</span>
            </UButton>
            <UBadge v-if="doc.sentAt" color="neutral" variant="subtle" size="sm">Sent</UBadge>
          </li>
        </ul>
      </div>
    </div>

    <ListingsApplyModal v-model:open="applyOpen" :listing="listing" @changed="emit('changed')" />
    <ListingsOutcomeModal
      v-model:open="outcomeOpen"
      :listing-id="listing.id"
      :outcomes="outcomes"
      :labels="listing.status === 'OFFER' ? offerLabels : undefined"
      :applied-at="appliedAt"
      @changed="emit('changed')"
    />
  </AppCard>
</template>
