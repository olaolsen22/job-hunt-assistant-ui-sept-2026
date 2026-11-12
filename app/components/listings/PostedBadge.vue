<script setup lang="ts">
// "Posted 3d ago" in the row; `compact` drops the icon and the word for the table's Posted column.
const { postedOn, compact = false } = defineProps<{ postedOn: string; compact?: boolean }>()

const days = computed(() => -daysFromToday(postedOn))
</script>

<template>
  <UBadge
    :color="URGENCY_BADGE_COLOR[postedLevel(days)]"
    variant="subtle"
    data-testid="listing-posted"
  >
    <UIcon v-if="!compact" name="i-lucide-calendar-plus" class="size-4 shrink-0" />
    <time :datetime="postedOn" :title="`Posted ${formatDate(postedOn)}`"
      >{{ compact ? '' : 'Posted ' }}{{ days <= 0 ? 'Today' : `${days}d ago` }}</time
    >
  </UBadge>
</template>
