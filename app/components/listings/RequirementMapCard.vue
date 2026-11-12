<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'
const { listing } = defineProps<{ listing: ListingDetail }>()
const { data: map, status, error, refresh } = useRequirementMapQuery(listing.id)
const counts = computed(() => matchCounts(map.value?.content.needs ?? []))
const review = computed(() => needsToReview(map.value?.content.needs ?? []))
const path = computed(() => `/listings/${listing.id}/requirements`)
</script>
<template>
  <AppCard title="Requirements" data-testid="requirement-map-card">
    <UAlert
      v-if="error"
      color="error"
      title="Couldn’t load requirements"
      :description="genericError(error)"
      :actions="[
        { label: 'Retry', color: 'neutral', variant: 'outline', onClick: () => refresh() }
      ]"
    />
    <USkeleton v-else-if="status === 'idle' || status === 'pending'" class="h-16 w-full" />
    <div v-else-if="map" class="space-y-4">
      <div class="flex flex-wrap gap-2" data-testid="requirement-map-counts">
        <UBadge
          v-for="match in REQUIREMENT_MATCHES"
          :key="match.value"
          :icon="match.icon"
          color="neutral"
          variant="subtle"
          >{{ counts[match.value as keyof typeof counts] }} {{ match.label.toLowerCase() }}</UBadge
        >
      </div>
      <p v-if="requirementMapStale(map.updatedAt, listing.updatedAt)" class="text-sm text-muted">
        This map may be out of date because the listing changed.
      </p>
      <ul v-if="review.length" class="space-y-3">
        <li v-for="(need, index) in review" :key="index" class="space-y-1 text-sm">
          <p class="break-words">
            <span class="font-medium"
              >{{ need.importance === 'REQUIRED' ? 'Required' : 'Preferred' }} ·
              {{ need.match === 'GAP' ? 'Gap' : 'Partial' }}:</span
            >
            {{ need.text }}
          </p>
          <p v-if="need.note" class="text-muted break-words">{{ need.note }}</p>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">No gaps — every requirement is evidenced.</p>
      <UButton :to="path" icon="i-lucide-pencil" color="neutral" variant="outline"
        >Edit requirements</UButton
      >
    </div>
    <div v-else class="space-y-3 text-center">
      <UIcon name="i-lucide-list-checks" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        Map what this job needs against your profile before choosing a CV.
      </p>
      <UButton :to="path" icon="i-lucide-list-checks" color="neutral" variant="subtle"
        >Map requirements</UButton
      >
    </div>
  </AppCard>
</template>
