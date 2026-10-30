<script setup lang="ts">
import type { ComparedListing } from '~/composables/listingCompareFields'

defineProps<{
  rows: { label: string; values: string[]; same: boolean }[]
  listing: ComparedListing
  match: ComparedListing
}>()

// Only URLs are too long for two narrow columns, so on phones they stack and name their side.
const SIDES = ['New', 'Existing']
</script>

<template>
  <!-- One row per field: below sm the label sits above the values, which line up under the
       modal's New | Existing header; from sm the label gets its own column. -->
  <div
    v-for="row in rows"
    :key="row.label"
    :class="[
      'grid grid-cols-2 gap-x-3 gap-y-1 border-b border-default p-2 sm:grid-cols-[8rem_1fr_1fr] sm:gap-x-4',
      { 'bg-elevated': !row.same }
    ]"
    :data-testid="row.same ? 'compare-row-same' : 'compare-row-differs'"
  >
    <dt class="col-span-2 text-xs text-muted sm:col-span-1 sm:text-sm">{{ row.label }}</dt>
    <dd
      v-for="(value, i) in row.values"
      :key="i"
      :class="['flex min-w-0 items-start gap-2', { 'max-sm:col-span-2': row.label === 'URL' }]"
    >
      <span v-if="row.label === 'URL'" class="w-14 shrink-0 text-xs text-muted sm:hidden">{{
        SIDES[i]
      }}</span>
      <ListingsStatusBadge
        v-if="row.label === 'Status'"
        :status="i ? match.status : listing.status"
      />
      <span v-else-if="!value" class="text-dimmed">—</span>
      <span
        v-else
        :class="[
          'min-w-0',
          row.label === 'URL' ? 'break-all' : 'break-words',
          { 'font-medium text-highlighted': !row.same }
        ]"
        >{{ value }}</span
      >
    </dd>
  </div>
</template>
