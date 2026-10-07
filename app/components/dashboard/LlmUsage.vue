<script setup lang="ts">
const { data, status, error, refresh } = useLlmUsage()
const usage = computed(() => data.value?.llmUsageToday)
const tokens = new Intl.NumberFormat()
</script>

<template>
  <!-- No link out: there is no page for usage. Never empty: zero requests is still a number. -->
  <DashboardWidget
    title="LLM usage"
    icon="i-lucide-sparkles"
    :loading="status === 'idle' || status === 'pending'"
    :error="!!error"
    :empty="false"
    empty-text=""
    @retry="refresh()"
  >
    <div v-if="usage" class="space-y-3" data-testid="dashboard-llm-usage">
      <p class="text-sm text-muted">
        <span class="text-2xl font-semibold text-highlighted">{{ usage.requests }}</span>
        <template v-if="usage.requestsLimit != null"> of {{ usage.requestsLimit }}</template>
        requests today
      </p>
      <UProgress
        v-if="usage.requestsLimit"
        :model-value="usage.requests"
        :max="usage.requestsLimit"
        data-testid="dashboard-llm-usage-bar"
      />
      <p v-if="usage.remainingRequests != null" class="text-sm text-muted">
        {{ usage.remainingRequests }} remaining
      </p>
      <p class="text-sm text-muted">
        {{ tokens.format(usage.inputTokens) }} tokens in ·
        {{ tokens.format(usage.outputTokens) }} out
      </p>
      <p class="text-xs text-muted">
        Resets {{ formatDateTime(usage.resetsAt) }}. Counts all users of the API.
      </p>
    </div>
  </DashboardWidget>
</template>
