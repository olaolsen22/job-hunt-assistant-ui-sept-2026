<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'

const { program } = defineProps<{
  program: NonNullable<ListingOverview['trainingProgram']>
}>()

const JOB_OFFER_TEXT = {
  GUARANTEED: 'Job guaranteed after the program',
  ON_PASS: 'Job offered if you pass',
  NONE: 'No job offer after the program',
  UNSPECIFIED: undefined
} as const

const facts = computed(() =>
  [
    { label: 'Hiring company', value: program.endCompany?.name },
    { label: 'Starts', value: program.startsOn ? formatDate(program.startsOn) : undefined },
    { label: 'Ends', value: program.endsOn ? formatDate(program.endsOn) : undefined },
    {
      label: 'Pay',
      value: program.isPaid == null ? undefined : program.isPaid ? 'Paid' : 'Unpaid'
    },
    { label: 'After the program', value: JOB_OFFER_TEXT[program.jobOffer] }
  ].filter((fact) => fact.value)
)
</script>

<template>
  <AppCard title="Training program" data-testid="overview-training">
    <dl v-if="facts.length" class="grid grid-cols-2 gap-x-6 gap-y-3 @2xl:flex @2xl:flex-wrap">
      <div v-for="fact in facts" :key="fact.label">
        <dt class="text-xs text-muted">{{ fact.label }}</dt>
        <dd class="text-sm font-medium">{{ fact.value }}</dd>
      </div>
    </dl>
    <p v-else class="text-sm text-muted">This listing is a training program.</p>
  </AppCard>
</template>
