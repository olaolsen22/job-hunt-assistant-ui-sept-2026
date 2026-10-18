<script setup lang="ts">
import type { ComparedListing } from '~/composables/listingCompareFields'

defineProps<{
  rows: { label: string; values: string[]; same: boolean }[]
  listing: ComparedListing
  match: ComparedListing
}>()

const SIDES = [
  { label: 'New', color: 'neutral' },
  { label: 'Existing', color: 'warning' }
] as const
</script>

<template>
  <!-- One row per field; below sm the two values stack under the label, tagged on differing rows. -->
  <div
    v-for="row in rows"
    :key="row.label"
    :class="[
      'grid gap-1 border-b border-default p-2 sm:grid-cols-[8rem_1fr_1fr] sm:gap-x-4',
      { 'bg-elevated': !row.same }
    ]"
    :data-testid="row.same ? 'compare-row-same' : 'compare-row-differs'"
  >
    <dt class="flex items-center gap-2 text-xs text-muted sm:text-sm">
      {{ row.label }}
      <UBadge v-if="!row.same" color="warning" variant="outline" size="sm">Differs</UBadge>
    </dt>
    <dd
      v-for="(value, i) in row.values"
      :key="SIDES[i]!.label"
      class="flex min-w-0 items-start gap-2"
    >
      <UBadge
        v-if="!row.same"
        :color="SIDES[i]!.color"
        variant="subtle"
        size="sm"
        class="sm:hidden"
        >{{ SIDES[i]!.label }}</UBadge
      >
      <ListingsStatusBadge
        v-if="row.label === 'Status'"
        :status="i ? match.status : listing.status"
      />
      <span v-else-if="!value" class="text-dimmed">—</span>
      <span
        v-else
        :class="['min-w-0 break-words', { 'font-medium text-highlighted': !row.same }]"
        >{{ value }}</span
      >
      <UIcon v-if="row.same && value" name="i-lucide-check" class="size-4 shrink-0 text-muted" />
    </dd>
  </div>
</template>
