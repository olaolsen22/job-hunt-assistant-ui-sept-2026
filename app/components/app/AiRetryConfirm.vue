<script setup lang="ts">
// Shown instead of the usual error after the API reports a run that was interrupted or whose
// result was lost: it may already have been billed, so another attempt needs an explicit yes.
defineProps<{ message: string; loading?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    title="That attempt may already have been charged"
    data-testid="ai-retry-confirm"
  >
    <template #description>
      <p>{{ message }}</p>
      <p>Trying again starts a new run, which may be charged again.</p>
    </template>
    <template #actions>
      <UButton
        color="warning"
        variant="soft"
        icon="i-lucide-rotate-ccw"
        :loading="loading"
        data-testid="ai-retry-confirm-run"
        @click="emit('retry')"
        >Try again (may be charged)</UButton
      >
    </template>
  </UAlert>
</template>
