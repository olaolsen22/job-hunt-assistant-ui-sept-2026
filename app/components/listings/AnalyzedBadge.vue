<script setup lang="ts">
const props = defineProps<{ analyzedAt: string | null; reanalyzedAt?: string | null }>()

// These are UTC instants, so format them as local dates rather than via formatDate (LocalDate).
const label = computed(() => {
  if (!props.analyzedAt) return 'To analyze'
  const date = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium' }).format(
    new Date(props.reanalyzedAt ?? props.analyzedAt)
  )
  return `${props.reanalyzedAt ? 'Re-analyzed' : 'Analyzed'} · ${date}`
})
</script>

<template>
  <UBadge
    :color="analyzedAt ? 'success' : 'warning'"
    variant="subtle"
    :icon="analyzedAt ? 'i-lucide-check' : 'i-lucide-clock'"
    class="whitespace-nowrap"
    data-testid="listing-analyzed"
    >{{ label }}</UBadge
  >
</template>
