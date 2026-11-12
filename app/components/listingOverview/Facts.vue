<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  SCHEDULE_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  languageLabel
} from '~/constants/listing'

const { listing } = defineProps<{ listing: ListingOverview }>()

const schedule = computed(() => {
  const label = optionLabel(SCHEDULE_OPTIONS, listing.schedule)
  const percent = listing.positionPercent == null ? undefined : `${listing.positionPercent} %`
  return [label, percent].filter(Boolean).join(', ') || undefined
})

// Only facts the ad states; an unset one is left out rather than shown as "Not stated".
const facts = computed(() =>
  [
    {
      key: 'work-mode',
      label: 'Work mode',
      value: optionLabel(WORK_MODE_OPTIONS, listing.workMode)
    },
    {
      key: 'employment',
      label: 'Employment',
      value: optionLabel(EMPLOYMENT_TYPE_OPTIONS, listing.employmentType)
    },
    { key: 'schedule', label: 'Schedule', value: schedule.value },
    {
      key: 'seniority',
      label: 'Seniority',
      value: optionLabel(SENIORITY_OPTIONS, listing.seniority)
    },
    {
      key: 'posted',
      label: 'Posted',
      value: listing.postedOn ? formatDate(listing.postedOn) : undefined
    },
    {
      key: 'language',
      label: 'Ad language',
      value: listing.postingLanguage ? languageLabel(listing.postingLanguage) : undefined
    }
  ].filter((fact) => fact.value)
)
</script>

<template>
  <UCard v-if="listing.locations.length || facts.length" data-testid="overview-facts">
    <dl class="grid grid-cols-2 gap-x-6 gap-y-3 @2xl:grid-cols-3 @5xl:flex @5xl:flex-wrap">
      <div v-if="listing.locations.length" class="col-span-2 @2xl:col-span-3">
        <dt class="text-xs text-muted">
          {{ listing.locations.length === 1 ? 'Location' : 'Locations' }}
        </dt>
        <dd class="flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium" data-testid="fact-locations">
          <span
            v-for="{ location } in listing.locations"
            :key="location.id"
            class="inline-flex items-center gap-1.5"
          >
            {{ formatLocation(location) }}
            <UBadge v-if="location.isTarget" color="primary" variant="subtle" size="sm"
              >Target</UBadge
            >
          </span>
        </dd>
      </div>
      <div v-for="fact in facts" :key="fact.key">
        <dt class="text-xs text-muted">{{ fact.label }}</dt>
        <dd class="text-sm font-medium" :data-testid="`fact-${fact.key}`">{{ fact.value }}</dd>
      </div>
    </dl>
  </UCard>
</template>
