<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

const { listing } = defineProps<{ listing: ListingListItem }>()
</script>

<template>
  <UCard data-testid="listing-card" class="group relative">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <div class="flex items-start gap-1">
          <h3 class="font-semibold text-highlighted">
            <!-- The ::after overlay stretches the link over the whole card, so the card
                 stays a real <a> (middle-click, open in new tab) without nesting buttons in it. -->
            <NuxtLink
              :to="`/listings/${listing.id}`"
              class="group-hover:underline after:absolute after:inset-0"
              >{{ listing.title }}</NuxtLink
            >
          </h3>
          <ListingsFavoriteButton
            :id="listing.id"
            :favorited-at="listing.favoritedAt"
            class="relative z-10 shrink-0"
          />
        </div>

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
        class="relative z-10 shrink-0"
        aria-label="View posting"
      />
    </div>
  </UCard>
</template>
