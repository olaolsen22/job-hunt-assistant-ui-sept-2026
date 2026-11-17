<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

const { listing } = defineProps<{ listing: ListingListItem }>()
defineEmits<{ changed: [] }>()

const seniority = computed(() => listingSeniority(listing))
const moreLocations = computed(() => listingMoreLocations(listing))
</script>

<template>
  <!-- Phones and tablets only; from lg the list page renders ListingsTable instead.
       Status badges sit inline after the title text (so they follow its last character when it
       wraps), and due + posted share the last line. Phones: a small card. md: two lines (star,
       title, actions, then meta and dates).
       The ::after on the title link stretches it over the item, so the item stays a real <a>
       (middle-click, new tab) while the star and ad link sit above it with z-10. -->
  <li
    class="group relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-default p-3 hover:bg-elevated/50 md:gap-x-4 md:gap-y-1 md:rounded-none md:border-0 md:px-4"
    data-testid="listing-row"
  >
    <ListingsShortlistButton
      :id="listing.id"
      :shortlisted-at="listing.shortlistedAt"
      size="md"
      class="relative z-10 order-2 md:order-1"
      @changed="$emit('changed')"
    />
    <AppFavoriteButton
      :id="listing.id"
      target="listing"
      :favorited-at="listing.favoritedAt"
      size="md"
      class="relative z-10 order-2 md:order-1"
    />

    <div class="order-1 min-w-0 flex-1 align-middle md:order-2 md:min-w-48">
      <h3 class="font-semibold text-highlighted">
        <NuxtLink
          :to="`/listings/${listing.id}`"
          class="group-hover:underline after:absolute after:inset-0"
          >{{ listing.title }}</NuxtLink
        >
        <span class="ml-1 inline-flex flex-wrap gap-1 align-middle">
          <ListingsStatusBadge :status="listing.status" />
          <ListingsAnalyzedBadge v-if="!listing.analyzedAt" :analyzed-at="null" />
        </span>
      </h3>
      <ListingsCompanyLine :listing="listing" />
    </div>

    <!-- Forces the md second line; the title above is free to take the whole first line. -->
    <div class="order-4 hidden basis-full md:block" aria-hidden="true" />

    <div
      class="order-3 flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted md:order-5 md:w-auto"
    >
      <p data-testid="listing-location">
        {{ listingFirstLocation(listing) }}
        <span v-if="moreLocations" class="text-dimmed">+{{ moreLocations }}</span>
      </p>
      <template v-if="seniority">
        <span aria-hidden="true">·</span>
        <p>{{ seniority }}</p>
      </template>
    </div>

    <div class="order-4 flex items-center gap-2 md:order-6">
      <!-- z-10 keeps the date tooltips reachable above the stretched link. -->
      <ListingsDueChip :listing="listing" class="relative z-10" />
      <ListingsPostedBadge
        v-if="listing.postedOn"
        :posted-on="listing.postedOn"
        class="relative z-10"
      />
    </div>

    <ListingsRowActions
      :listing="listing"
      class="relative z-10 order-5 ml-auto md:order-3 md:ml-0"
      @changed="$emit('changed')"
    />
  </li>
</template>
