<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Job listings' })

const { listings, totalCount, hasNextPage, hasPrevPage, loading, error, nextPage, prevPage } =
  useListingsList()
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <UButton to="/listings/add" icon="i-lucide-plus">Add listing</UButton>
    </div>

    <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

    <div
      v-else-if="loading && listings.length === 0"
      class="grid gap-4 lg:grid-cols-2"
      data-testid="listings-loading"
    >
      <USkeleton v-for="i in 6" :key="i" class="h-28 w-full" />
    </div>

    <div
      v-else-if="listings.length === 0"
      class="flex flex-col items-center gap-3 py-16 text-center"
      data-testid="listings-empty"
    >
      <UIcon name="i-lucide-inbox" class="size-10 text-muted" />
      <p>No listings yet.</p>
      <UButton to="/listings/add">Add listing</UButton>
    </div>

    <template v-else>
      <p class="text-sm text-muted">{{ totalCount }} listings</p>

      <div class="grid gap-4 lg:grid-cols-2" data-testid="listings-grid">
        <ListingsCard v-for="listing in listings" :key="listing.id" :listing="listing" />
      </div>

      <div v-if="hasNextPage || hasPrevPage" class="flex justify-center gap-2">
        <UButton
          variant="outline"
          color="neutral"
          :disabled="!hasPrevPage || loading"
          data-testid="listings-prev"
          @click="prevPage"
        >
          Previous
        </UButton>
        <UButton
          variant="outline"
          color="neutral"
          :disabled="!hasNextPage || loading"
          data-testid="listings-next"
          @click="nextPage"
        >
          Next
        </UButton>
      </div>
    </template>
  </div>
</template>
