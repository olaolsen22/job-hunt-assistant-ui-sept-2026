<script setup lang="ts">
import type { ComparedListing } from '~/composables/listingCompareFields'
import { DEADLINE_TYPE_OPTIONS } from '~/constants/listing'

const { listing, matches } = defineProps<{
  listing: ComparedListing
  matches: ComparedListing[]
}>()
const open = defineModel<boolean>('open', { required: true })
const matchId = defineModel<number>('matchId', { required: true })
const emit = defineEmits<{ keep: []; remove: [] }>()

const match = computed(() => matches.find((m) => m.id === matchId.value) ?? matches[0]!)
const matchItems = computed(() =>
  matches.map((m) => ({ label: `${m.title} · ${m.company.name}`, value: m.id }))
)

const SIDES = [
  { label: 'New', color: 'neutral' },
  { label: 'Existing', color: 'warning' }
] as const

// Compared as displayed text, so e.g. the same locations in another order still match.
const fields = (l: ComparedListing) => ({
  Title: l.title,
  Company: l.company.name,
  Role: l.jobRole.name,
  URL: l.url,
  Locations: l.locations
    .map((x) => formatLocation(x.location))
    .sort()
    .join(' · '),
  Posted: formatDate(l.postedOn),
  Deadline:
    l.deadlineType === 'DATE' && l.deadlineOn
      ? formatDate(l.deadlineOn)
      : DEADLINE_TYPE_OPTIONS.find((o) => o.value === l.deadlineType)!.label,
  Status: l.status
})

const rows = computed(() => {
  const left = fields(listing)
  const right = fields(match.value)
  return (Object.keys(left) as (keyof typeof left)[]).map((label) => ({
    label,
    values: [left[label], right[label]],
    same: left[label] === right[label]
  }))
})
</script>

<template>
  <!-- The default sm:max-w-lg is too narrow for a label column plus two value columns. -->
  <UModal v-model:open="open" title="Compare listings" :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <UFormField v-if="matches.length > 1" label="Compare with" class="mb-4">
        <USelect
          v-model="matchId"
          :items="matchItems"
          class="w-full"
          data-testid="compare-select"
        />
      </UFormField>

      <dl class="text-sm">
        <div
          class="hidden grid-cols-[8rem_1fr_1fr] gap-x-4 border-b border-default px-2 pb-2 text-muted sm:grid"
        >
          <span />
          <span v-for="side in SIDES" :key="side.label">{{ side.label }}</span>
        </div>
        <!-- One row per field; below sm the two values stack under the label, each tagged. -->
        <div
          v-for="row in rows"
          :key="row.label"
          :class="[
            'grid gap-1 border-b border-default p-2 sm:grid-cols-[8rem_1fr_1fr] sm:gap-x-4',
            { 'bg-elevated': !row.same }
          ]"
          :data-testid="row.same ? 'compare-row-same' : 'compare-row-differs'"
        >
          <dt class="text-xs text-muted sm:text-sm">{{ row.label }}</dt>
          <dd
            v-for="(value, i) in row.values"
            :key="SIDES[i]!.label"
            class="flex min-w-0 items-center gap-2"
          >
            <UBadge :color="SIDES[i]!.color" variant="subtle" size="sm" class="sm:hidden">{{
              SIDES[i]!.label
            }}</UBadge>
            <ListingsStatusBadge
              v-if="row.label === 'Status'"
              :status="i ? match.status : listing.status"
            />
            <span v-else-if="!value" class="text-dimmed">—</span>
            <span
              v-else
              :title="value"
              :class="['truncate', { 'font-medium text-highlighted': !row.same }]"
              >{{ value }}</span
            >
            <UIcon
              v-if="row.same && value"
              name="i-lucide-check"
              class="size-4 shrink-0 text-muted"
            />
          </dd>
        </div>
      </dl>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          :to="`/listings/${match.id}`"
          target="_blank"
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          class="justify-center sm:mr-auto"
          >Open existing</UButton
        >
        <UButton
          color="neutral"
          variant="subtle"
          class="justify-center"
          data-testid="compare-keep"
          @click="emit('keep')"
          >Keep both</UButton
        >
        <UButton
          color="error"
          variant="soft"
          class="justify-center"
          data-testid="compare-remove"
          @click="emit('remove')"
          >Remove new one</UButton
        >
      </div>
    </template>
  </UModal>
</template>
