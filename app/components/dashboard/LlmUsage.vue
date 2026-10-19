<script setup lang="ts">
const { data, status, error, refresh } = useLlmUsage()
const usage = computed(() => data.value?.llmUsageToday)
// Compact (12.4K): the exact count of a day's tokens isn't worth the width.
const tokens = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
// Warn before the limit is hit, not only when it is.
const barColor = computed(() => {
  const { requests, requestsLimit } = usage.value ?? {}
  if (!requestsLimit || requests == null) return 'primary'
  if (requests >= requestsLimit) return 'error'
  return requests >= requestsLimit * 0.8 ? 'warning' : 'primary'
})
// The numbers are for the user's current default model.
const { label } = useLlmModels()
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
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted">
          <span class="text-2xl font-semibold text-highlighted">{{ usage.requests }}</span>
          <template v-if="usage.requestsLimit != null"> of {{ usage.requestsLimit }}</template>
          requests today
          <template v-if="usage.requestsLimit == null"> · No daily limit</template>
        </p>
        <UBadge color="neutral" variant="subtle" data-testid="dashboard-llm-usage-model">{{
          label(usage.model)
        }}</UBadge>
      </div>
      <UProgress
        v-if="usage.requestsLimit"
        :model-value="usage.requests"
        :max="usage.requestsLimit"
        :color="barColor"
        data-testid="dashboard-llm-usage-bar"
      />
      <p v-if="usage.remainingRequests != null" class="text-sm text-muted">
        {{ usage.remainingRequests }} remaining
      </p>
      <dl class="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt class="text-muted">Input tokens</dt>
          <dd class="font-medium text-highlighted">{{ tokens.format(usage.inputTokens) }}</dd>
        </div>
        <div>
          <dt class="text-muted">Output tokens</dt>
          <dd class="font-medium text-highlighted">{{ tokens.format(usage.outputTokens) }}</dd>
        </div>
      </dl>
      <p class="text-xs text-muted">Resets {{ formatDateTime(usage.resetsAt) }}.</p>
    </div>
  </DashboardWidget>
</template>
