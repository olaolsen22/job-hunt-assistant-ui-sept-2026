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

const showSummary = computed(
  () =>
    listing.status === 'SAVED' || listing.company.applicationCount > 0 || outcomes.value.length > 0
)

const applyOpen = defineModel<boolean>('applyOpen', { default: false })
// Mounted on first open: it fetches the tailored CV draft, which the page doesn't need until then.
const applyOpened = useOpenedOnce(applyOpen)
const outcomeOpen = ref(false)
</script>

<template>
  <AppCard title="Application">
    <template v-if="listing.status === 'SAVED'" #actions>
      <UButton size="sm" icon="i-lucide-check" data-testid="listing-apply" @click="applyOpen = true"
        >Record application</UButton
      >
    </template>
    <div class="space-y-6">
      <div v-if="showSummary" class="flex flex-col items-start gap-3">
        <div
          v-if="listing.status === 'SAVED' || listing.company.applicationCount"
          class="w-full min-w-0 space-y-1 text-center"
        >
          <!-- The status badge is in the page header, so only what it doesn't say is here. -->
          <span
            v-if="listing.status === 'SAVED'"
            class="block break-words text-sm text-muted"
            data-testid="listing-not-applied"
            >Not applied yet</span
          >
          <span
            v-if="listing.company.applicationCount"
            class="block break-words text-sm text-muted"
            data-testid="listing-application-count"
            >Applications to {{ listing.company.name }}:
            {{ listing.company.applicationCount }}</span
          >
        </div>

        <div v-if="outcomes.length" class="flex flex-wrap gap-2">
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
        class="grid gap-6 xl:grid-cols-2"
        :class="{ 'border-t border-muted pt-6': showSummary }"
      >
        <div class="space-y-3">
          <h3 class="font-medium text-highlighted">Timeline</h3>
          <ListingsStatusTimeline :listing="listing" @changed="emit('changed')" />
        </div>
        <!-- Stacked below xl, side by side from xl, so the divider flips from top to left.
             Wrapped: Interviews has multiple roots (its modals), so a class on it is dropped. -->
        <div class="border-t border-muted pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
          <ListingsInterviews :listing="listing" @changed="emit('changed')" />
        </div>
      </div>

      <div v-if="listing.documents.length" class="space-y-3 border-t border-muted pt-6">
        <h3 class="font-medium text-highlighted">Documents</h3>
        <ul class="space-y-3" data-testid="listing-documents">
          <li v-for="doc in listing.documents" :key="doc.id" class="space-y-1">
            <div class="flex items-start gap-2">
              <!-- `external` because /api/** is a proxied backend route, not a Nuxt page. -->
              <UButton
                :to="`/api/documents/${doc.id}`"
                external
                target="_blank"
                variant="link"
                size="sm"
                icon="i-lucide-file-text"
                class="min-w-0 items-start p-0"
              >
                <span class="whitespace-normal break-words text-left">{{ doc.fileName }}</span>
              </UButton>
              <UBadge v-if="doc.sentAt" color="neutral" variant="subtle" size="sm" class="shrink-0"
                >Sent</UBadge
              >
            </div>
            <p class="text-xs text-muted">
              Created <time :datetime="doc.createdAt">{{ formatDateTime(doc.createdAt) }}</time
              ><template v-if="documentOriginLabel(doc)">
                · <span data-testid="listing-document-origin">{{ documentOriginLabel(doc) }}</span>
              </template>
            </p>
          </li>
        </ul>
      </div>
    </div>

    <LazyListingsApplyModal
      v-if="applyOpened"
      v-model:open="applyOpen"
      :listing="listing"
      @changed="emit('changed')"
    />
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
