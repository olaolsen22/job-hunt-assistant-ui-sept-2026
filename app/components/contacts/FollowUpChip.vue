<script setup lang="ts">
const { followUpOn } = defineProps<{ followUpOn: string }>()

const summary = computed(() => followUpSummary(followUpOn))
</script>

<template>
  <UBadge
    :color="summary.color"
    variant="subtle"
    :icon="summary.daysLeft < 0 ? 'i-lucide-bell-ring' : 'i-lucide-bell'"
    class="shrink-0"
    data-testid="follow-up-chip"
  >
    <time :datetime="followUpOn" :title="`Follow up by ${formatDate(followUpOn)}`">{{
      summary.label
    }}</time>
  </UBadge>
</template>
