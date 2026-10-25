<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'
import { DEADLINE_TYPE_OPTIONS } from '~/constants/listing'

const { listing } = defineProps<{
  listing: Pick<ListingListItem, 'postedOn' | 'deadlineType' | 'deadlineOn' | 'dueOn'>
}>()

// An unsolicited application has neither a posting date nor a due date; those lines are left out.
const postedClass = computed(() =>
  listing.postedOn ? URGENCY_TEXT[postedLevel(-daysFromToday(listing.postedOn))] : undefined
)

const hasDeadlineDate = computed(() => listing.deadlineType === 'DATE' && !!listing.deadlineOn)

// The server owns the due date (DATE: the deadline, ASAP: posted + 14, otherwise posted + 30),
// so the colors and expiry here match the list's sort order.
const dueDaysLeft = computed(() => (listing.dueOn ? daysFromToday(listing.dueOn) : 0))

const isExpired = computed(() => dueDaysLeft.value < 0)

const deadlineClass = computed(() => URGENCY_TEXT[deadlineLevel(dueDaysLeft.value)])

const deadlineLabel = computed(() => {
  if (hasDeadlineDate.value) {
    const date = formatDate(listing.deadlineOn!)
    return isExpired.value ? `${date}, expired` : date
  }

  const type = DEADLINE_TYPE_OPTIONS.find((option) => option.value === listing.deadlineType)!.label
  return isExpired.value ? `${type}, likely filled` : `${type}, due ~${formatDate(listing.dueOn!)}`
})
</script>

<template>
  <div class="space-y-1 text-sm">
    <p
      v-if="listing.postedOn"
      class="flex items-center gap-1.5"
      :class="postedClass"
      data-testid="listing-posted"
    >
      <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
      <strong>Posted:</strong> {{ formatDate(listing.postedOn) }}
    </p>
    <p
      v-if="listing.dueOn"
      class="flex items-center gap-1.5"
      :class="deadlineClass"
      data-testid="listing-deadline"
    >
      <UIcon name="i-lucide-hourglass" class="size-4 shrink-0" />
      <strong>Deadline:</strong> {{ deadlineLabel }}
    </p>
  </div>
</template>
