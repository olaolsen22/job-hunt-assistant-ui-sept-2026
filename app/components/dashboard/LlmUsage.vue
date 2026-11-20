<script setup lang="ts">
const { data, status, error, refresh } = useLlmUsage()
const usage = computed(() => data.value?.llmUsageToday)
// Compact (12.4K): the exact count of a day's tokens isn't worth the width.
const tokens = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

const { cap, state, loading: capLoading } = useRequestCap(usage, usage)
// Warn before the limit is hit, not only when it is.
const barColor = computed(() =>
  state.value === 'reached' ? 'error' : state.value === 'near' ? 'warning' : 'primary'
)
// The numbers are for the user's current default model.
const { label } = useLlmModels()
// Usage history lives in the owner's part of Settings.
const auth = useAuthStore()
const isOwner = computed(() => auth.user?.role === 'Owner')
</script>

<template>
  <!-- Never empty: zero requests is still a number. -->
  <DashboardWidget
    title="LLM usage"
    icon="i-lucide-sparkles"
    :to="isOwner ? '/settings#usage' : undefined"
    :loading="status === 'idle' || status === 'pending' || capLoading"
    :error="!!error"
    :empty="false"
    empty-text=""
    @retry="refresh()"
  >
    <div v-if="usage" class="space-y-3" data-testid="dashboard-llm-usage">
      <!-- No cap only when an own key's limit failed to load: the tokens still show. -->
      <div v-if="cap" class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted">
          <span class="text-2xl font-semibold text-highlighted">{{ cap.used }}</span>
          <template v-if="cap.max != null"> of {{ cap.max }}</template>
          requests today
          <template v-if="cap.max == null"> · No daily limit</template>
        </p>
        <UBadge color="neutral" variant="subtle" data-testid="dashboard-llm-usage-model">{{
          label(usage.model)
        }}</UBadge>
      </div>
      <UProgress
        v-if="cap?.max"
        :model-value="cap.used"
        :max="cap.max"
        :color="barColor"
        data-testid="dashboard-llm-usage-bar"
      />
      <p v-if="cap?.max === 0" class="text-sm text-muted">Paused in Settings</p>
      <p v-else-if="cap?.left != null" class="text-sm text-muted">
        {{ cap.left }} remaining<template v-if="cap.pooled"> for all users</template>
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
      <p class="text-xs text-muted">
        Resets {{ formatDateTime(cap?.resetsAt ?? usage.resetsAt) }}.
      </p>
    </div>
  </DashboardWidget>
</template>
