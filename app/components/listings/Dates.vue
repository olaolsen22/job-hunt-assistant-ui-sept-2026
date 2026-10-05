<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'
import { DEADLINE_TYPE_OPTIONS } from '~/constants/listing'

const { listing, detail = false } = defineProps<{
  listing: Pick<ListingListItem, 'postedOn' | 'deadlineType' | 'deadlineOn' | 'dueOn'>
  // Renders two label/value grid cells for the detail page instead of the compact card lines.
  detail?: boolean
}>()

const RED = 'text-red-600/85 dark:text-red-400/85'
const ORANGE = 'text-orange-600/85 dark:text-orange-400/85'
const YELLOW = 'text-yellow-600/85 dark:text-yellow-400/85'
const GREEN = 'text-green-600/85 dark:text-green-400/85'
const BLUE = 'text-blue-600/85 dark:text-blue-400/85'

// Past deadlines fall into the `<= 0` bucket and stay red.
const deadlineColor = (daysLeft: number) => {
  if (daysLeft <= 0) return RED
  if (daysLeft <= 3) return ORANGE
  if (daysLeft <= 5) return YELLOW
  if (daysLeft <= 7) return GREEN
  return BLUE
}

const postedColor = (daysAgo: number) => {
  if (daysAgo <= 0) return BLUE
  if (daysAgo <= 3) return GREEN
  if (daysAgo <= 5) return YELLOW
  if (daysAgo <= 7) return ORANGE
  return RED
}

const daysSincePosted = computed(() => -daysFromToday(listing.postedOn))

const postedClass = computed(() => postedColor(daysSincePosted.value))

const hasDeadlineDate = computed(() => listing.deadlineType === 'DATE' && !!listing.deadlineOn)

// The server owns the due date (DATE: the deadline, ASAP: posted + 14, otherwise posted + 30),
// so the colors and expiry here match the list's sort order.
const dueDaysLeft = computed(() => daysFromToday(listing.dueOn))

const isExpired = computed(() => dueDaysLeft.value < 0)

const deadlineClass = computed(() => (isExpired.value ? RED : deadlineColor(dueDaysLeft.value)))

const deadlineLabel = computed(() => {
  if (hasDeadlineDate.value) {
    const date = formatDate(listing.deadlineOn!)
    return isExpired.value ? `${date}, expired` : date
  }

  const type = DEADLINE_TYPE_OPTIONS.find((option) => option.value === listing.deadlineType)!.label
  return isExpired.value ? `${type}, likely filled` : `${type}, due ~${formatDate(listing.dueOn)}`
})
</script>

<template>
  <template v-if="detail">
    <div class="space-y-1">
      <p class="text-sm font-medium text-highlighted">Posted on</p>
      <p class="text-sm" :class="postedClass" data-testid="listing-posted">
        {{ formatDate(listing.postedOn) }}
      </p>
    </div>
    <div class="space-y-1">
      <p class="text-sm font-medium text-highlighted">Deadline</p>
      <p class="text-sm" :class="deadlineClass" data-testid="listing-deadline">
        {{ deadlineLabel }}
      </p>
    </div>
  </template>
  <div v-else class="space-y-1 text-sm">
    <p class="flex items-center gap-1.5" :class="postedClass" data-testid="listing-posted">
      <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
      <strong>Posted:</strong> {{ formatDate(listing.postedOn) }}
    </p>
    <p class="flex items-center gap-1.5" :class="deadlineClass" data-testid="listing-deadline">
      <UIcon name="i-lucide-hourglass" class="size-4 shrink-0" />
      <strong>Deadline:</strong> {{ deadlineLabel }}
    </p>
  </div>
</template>
