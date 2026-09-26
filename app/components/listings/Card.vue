<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

const { listing } = defineProps<{ listing: ListingListItem }>()
</script>

<template>
  <UCard data-testid="listing-card">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <h3 class="font-semibold text-highlighted">{{ listing.title }}</h3>

        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
          {{ listing.company.name }}
        </p>

        <ListingsLocation :listing="listing" />

        <ListingsDates :listing="listing" />
      </div>

      <UButton
        :to="listing.url"
        target="_blank"
        rel="noopener"
        variant="ghost"
        color="neutral"
        icon="i-lucide-external-link"
        class="shrink-0"
        aria-label="View posting"
      />
    </div>
  </UCard>
</template>
