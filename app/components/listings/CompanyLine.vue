<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

// "Company · Role" under the title, in the row and the table's Title cell. `withSeniority` adds
// the seniority where the table has no room for its column. `truncate` (table) cuts only the text,
// so the seniority and the avoided-company warning always stay readable.
const {
  listing,
  withSeniority = false,
  truncate = false
} = defineProps<{
  listing: ListingListItem
  withSeniority?: boolean
  truncate?: boolean
}>()

const seniority = computed(() => (withSeniority ? listingSeniority(listing) : null))
const text = computed(() => [listing.company.name, listing.jobRole.name].join(' · '))
</script>

<template>
  <p class="text-sm text-muted" :class="truncate && 'flex items-center'">
    <span :class="truncate && 'min-w-0 truncate'" :title="truncate ? text : undefined">{{
      text
    }}</span>
    <span
      v-if="seniority"
      class="ml-1 shrink-0 whitespace-nowrap"
      data-testid="company-line-seniority"
      >· {{ seniority }}</span
    >
    <!-- Inline, not a badge, so it reads as part of the company line. -->
    <span
      v-if="listing.company.avoidedAt"
      class="ml-1 inline-flex shrink-0 items-center gap-1 text-warning"
      data-testid="company-avoided"
      ><UIcon name="i-lucide-ban" class="size-3.5" />Avoided company</span
    >
  </p>
</template>
