<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Job listings' })

const { listings, totalCount, page, pageSize, loading, error } = useListingsList()
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

      <!-- UPagination still renders a lone "1" with disabled arrows when everything fits on one page. -->
      <div v-if="totalCount > pageSize" class="flex justify-center sm:justify-end">
        <UPagination
          v-model:page="page"
          :total="totalCount"
          :items-per-page="pageSize"
          :disabled="loading"
          data-testid="listings-pagination"
        />
      </div>
    </template>
  </div>
</template>
