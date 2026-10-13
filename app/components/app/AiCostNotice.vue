<script setup lang="ts">
import type { LlmUsage } from '~/composables/useLlmUsage'

// Built-in AI costs money: on the app's shared key, or on the owner's own provider account when
// the default model runs on their key. No price: the UI doesn't know it.
const { usage = undefined } = defineProps<{ usage?: LlmUsage }>()
const tokens = new Intl.NumberFormat()
const { models, defaultModel, label } = useLlmModels()
const current = computed(() => models.value.find((m) => m.id === defaultModel.value))
const ownKey = computed(() => current.value?.keySource === 'USER')

// Only the owner's own keys have limits, so they're fetched only when one is in use.
const { limits, status: limitsStatus, execute: loadLimits } = useLlmCallLimits(false)
watch(
  ownKey,
  (own) => {
    if (own && limitsStatus.value === 'idle') loadLimits()
  },
  { immediate: true }
)
const remaining = computed(() => {
  const limit = limits.value.find((l) => l.provider === current.value?.provider)
  if (limit?.dailyRequestLimit == null) return undefined
  return limit.dailyRequestLimit === 0
    ? 'This key is paused in Settings.'
    : `${limit.remainingRequests ?? 0} requests left today.`
})
</script>

<template>
  <UAlert
    :color="ownKey ? 'info' : 'warning'"
    variant="subtle"
    :icon="ownKey ? 'i-lucide-key-round' : 'i-lucide-coins'"
    :title="ownKey ? 'Uses your own AI key' : 'Uses the app’s paid AI key'"
  >
    <template #description>
      <p data-testid="ai-notice-billing">
        <template v-if="ownKey && current"
          >Each run is billed to your own {{ providerLabel(current.provider) }} key</template
        >
        <template v-else>Each run is billed to the app’s AI account</template
        ><template v-if="defaultModel">
          and uses <span data-testid="ai-notice-model">{{ label(defaultModel) }}</span></template
        >.
        <template v-if="ownKey && remaining">{{ remaining }}</template>
        <ULink to="/settings" class="font-medium underline">Change model</ULink>
      </p>
      <template v-if="usage">
        <p data-testid="ai-usage-tokens">
          {{ tokens.format(usage.inputTokens) }} tokens in ·
          {{ tokens.format(usage.outputTokens) }} out
        </p>
        <p data-testid="ai-usage-requests">
          {{ label(usage.model) }} ·
          {{
            usage.requestsLimit != null
              ? `${usage.requests} of ${usage.requestsLimit}`
              : usage.requests
          }}
          requests
        </p>
      </template>
    </template>
  </UAlert>
</template>
