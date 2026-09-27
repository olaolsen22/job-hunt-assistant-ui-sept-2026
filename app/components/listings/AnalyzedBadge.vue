<script setup lang="ts">
defineProps<{ analyzedAt: string | null }>()
</script>

<template>
  <UBadge
    :color="analyzedAt ? 'success' : 'warning'"
    variant="subtle"
    :icon="analyzedAt ? 'i-lucide-check' : 'i-lucide-clock'"
    data-testid="listing-analyzed"
    >{{ analyzedAt ? 'Analyzed' : 'To analyze' }}</UBadge
  >
</template>
