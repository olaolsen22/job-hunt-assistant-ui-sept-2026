<script setup lang="ts">
const { data, error, status, refresh } = useFetch<string>('/api/health', { responseType: 'text' })

const state = computed(() => {
  if (status.value === 'idle' || status.value === 'pending') {
    return { label: 'Checking…', color: 'neutral' as const }
  }
  if (data.value === 'Healthy') return { label: 'Healthy', color: 'success' as const }
  // 503 = API up, database down. Anything else means the API itself is unreachable.
  if (error.value?.statusCode === 503) return { label: 'Unhealthy', color: 'error' as const }
  return { label: 'Unreachable', color: 'warning' as const }
})
</script>

<template>
  <AppCard title="API status">
    <div class="flex items-center justify-between gap-4">
      <UBadge :color="state.color" variant="subtle" size="lg" data-testid="api-health">
        {{ state.label }}
      </UBadge>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="ghost"
        :loading="status === 'pending'"
        @click="() => refresh()"
      >
        Recheck
      </UButton>
    </div>
  </AppCard>
</template>
