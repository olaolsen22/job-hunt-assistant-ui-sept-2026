<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Job listings' })

const { listings, totalCount, toAnalyzeCount, page, pageSize, toAnalyzeOnly, loading, error } =
  useListingsList()
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <!-- "Active" because listings past their deadline are filtered out server-side. -->
      <div v-if="listings.length" class="flex flex-wrap items-center gap-2">
        <p class="text-lg font-semibold text-highlighted" data-testid="listings-total">
          {{ totalCount }} active {{ totalCount === 1 ? 'listing' : 'listings' }}
        </p>
        <UButton
          v-if="toAnalyzeCount"
          color="warning"
          :variant="toAnalyzeOnly ? 'solid' : 'subtle'"
          size="sm"
          icon="i-lucide-clock"
          :trailing-icon="toAnalyzeOnly ? 'i-lucide-x' : undefined"
          data-testid="listings-to-analyze"
          @click="toAnalyzeOnly = !toAnalyzeOnly"
          >{{ toAnalyzeCount }} to analyze</UButton
        >
      </div>
      <div class="flex flex-col gap-2 sm:ml-auto sm:flex-row">
        <UButton
          to="/listings/quick-add"
          icon="i-lucide-list-plus"
          color="neutral"
          variant="subtle"
          class="justify-center"
          data-testid="quick-add-open"
          >Quick add</UButton
        >
        <UButton to="/listings/add" icon="i-lucide-plus" class="justify-center">
          Add listing
        </UButton>
      </div>
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
