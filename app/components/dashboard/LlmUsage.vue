<script setup lang="ts">
const { data, status, error, refresh } = useLlmUsage()
const usage = computed(() => data.value?.llmUsageToday)
const tokens = new Intl.NumberFormat()
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
        </p>
        <UBadge color="neutral" variant="subtle" data-testid="dashboard-llm-usage-model">{{
          label(usage.model)
        }}</UBadge>
      </div>
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
      <p class="text-xs text-muted">Resets {{ formatDateTime(usage.resetsAt) }}.</p>
    </div>
  </DashboardWidget>
</template>
