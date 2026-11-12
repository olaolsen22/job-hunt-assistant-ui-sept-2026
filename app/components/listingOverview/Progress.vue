<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'

const { listing } = defineProps<{
  listing: Pick<ListingOverview, 'statusHistory' | 'interviews' | 'applicationQuestions'>
}>()

const history = computed(() => listing.statusHistory.toReversed())

// Upcoming first (soonest at the top), then past ones, latest first.
const interviews = computed(() => {
  const now = Date.now()
  const upcoming = listing.interviews.filter((i) => Date.parse(i.scheduledAt) >= now)
  const past = listing.interviews.filter((i) => Date.parse(i.scheduledAt) < now).toReversed()
  return [
    ...upcoming.map((interview) => ({ interview, upcoming: true })),
    ...past.map((interview) => ({ interview, upcoming: false }))
  ]
})

// Calendar days in the owner's zone, so tonight is "today" and tomorrow morning is "tomorrow".
const relativeDays = (iso: string) => {
  const days = daysFromToday(new Date(iso).toLocaleDateString('sv-SE'))
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
}
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-3">
      <h3 class="text-sm font-semibold">Status history</h3>
      <ol v-if="history.length" class="space-y-3">
        <li
          v-for="change in history"
          :key="change.id"
          class="space-y-1"
          data-testid="overview-status-change"
        >
          <div class="flex flex-wrap items-center gap-2">
            <ListingsStatusBadge :status="change.status" />
            <span class="text-sm text-muted">{{ formatDateTime(change.occurredAt) }}</span>
          </div>
          <div v-if="change.note" class="max-w-prose text-sm text-muted">
            <LazyAppMarkdownContent :source="change.note" />
          </div>
        </li>
      </ol>
      <p v-else class="text-sm text-muted">No status changes yet.</p>
    </section>

    <section v-if="interviews.length" class="space-y-3">
      <h3 class="text-sm font-semibold">Interviews</h3>
      <ul class="space-y-3">
        <li
          v-for="{ interview, upcoming } in interviews"
          :key="interview.id"
          class="space-y-1"
          data-testid="overview-interview"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium">{{ interview.title || 'Interview' }}</span>
            <UBadge v-if="upcoming" color="info" variant="subtle" size="sm">{{
              relativeDays(interview.scheduledAt)
            }}</UBadge>
          </div>
          <p class="text-sm" :class="upcoming ? 'text-default' : 'text-muted'">
            {{ formatDateTime(interview.scheduledAt) }}
          </p>
          <div v-if="interview.notes" class="max-w-prose text-sm text-muted">
            <LazyAppMarkdownContent :source="interview.notes" />
          </div>
        </li>
      </ul>
    </section>

    <section v-if="listing.applicationQuestions.length" class="space-y-3">
      <h3 class="text-sm font-semibold">Application questions</h3>
      <ul class="space-y-4">
        <li
          v-for="q in listing.applicationQuestions"
          :key="q.id"
          class="max-w-prose space-y-1"
          data-testid="overview-question"
        >
          <p class="text-sm font-medium wrap-break-word">{{ q.question }}</p>
          <p v-if="q.charLimit" class="text-xs text-muted">Max {{ q.charLimit }} characters</p>
          <p v-if="q.answer" class="text-sm wrap-break-word whitespace-pre-line">{{ q.answer }}</p>
          <p v-else class="text-sm text-muted">Not answered yet</p>
          <div v-if="q.notes" class="text-sm text-muted">
            <LazyAppMarkdownContent :source="q.notes" />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
