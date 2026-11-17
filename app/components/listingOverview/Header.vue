<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'
import { LISTING_KIND_OPTIONS } from '~/constants/listing'

const { listing } = defineProps<{ listing: ListingOverview }>()

// The API owns dueOn (DATE: the deadline, ASAP: posted + 14, otherwise posted + 30), so only a
// dated deadline is exact; the others show the estimate with "~" like the listings list.
const due = computed(() => dueSummary(listing))
const deadline = computed(() => {
  if (!due.value) return null
  const text =
    listing.deadlineType === 'DATE' && listing.deadlineOn
      ? `${formatDate(listing.deadlineOn)} · ${due.value.label}`
      : `${listing.deadlineType === 'ASAP' ? '' : 'Not stated · '}${due.value.label} (due ~${formatDate(listing.dueOn!)})`
  return { text, class: URGENCY_TEXT[deadlineLevel(due.value.daysLeft)] }
})
</script>

<template>
  <header class="space-y-3">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-2">
        <h1
          class="text-2xl font-semibold wrap-break-word text-highlighted"
          data-testid="overview-title"
        >
          {{ listing.title }}
        </h1>
        <p class="wrap-break-word text-muted">
          <ULink :to="`/companies/${listing.company.id}`" class="font-medium text-default">{{
            listing.company.name
          }}</ULink>
          · {{ listing.jobRole.name }}
        </p>

        <div class="flex flex-wrap items-center gap-2" data-testid="overview-badges">
          <ListingsStatusBadge :status="listing.status" />
          <UBadge v-if="listing.kind !== 'VACANCY'" color="neutral" variant="outline">{{
            optionLabel(LISTING_KIND_OPTIONS, listing.kind)
          }}</UBadge>
          <UBadge v-if="listing.favoritedAt" color="warning" variant="subtle" icon="i-lucide-star"
            >Favorite</UBadge
          >
          <UBadge v-if="listing.archivedAt" color="neutral" variant="subtle" icon="i-lucide-archive"
            >Archived</UBadge
          >
          <CompaniesAvoidedBadge v-if="listing.company.avoidedAt" label="Avoided company" />
        </div>

        <p
          v-if="deadline"
          class="flex items-center gap-1.5 text-sm"
          :class="deadline.class"
          data-testid="overview-deadline"
        >
          <UIcon name="i-lucide-hourglass" class="size-4 shrink-0" />
          <strong>Deadline:</strong> {{ deadline.text }}
        </p>
      </div>

      <UButton
        v-if="listing.url"
        :to="listing.url"
        target="_blank"
        icon="i-lucide-external-link"
        class="shrink-0 justify-center"
        data-testid="overview-posting-link"
        >View original posting</UButton
      >
    </div>
  </header>
</template>
