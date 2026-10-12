<script setup lang="ts">
import type { LlmUsage } from '~/composables/useLlmUsage'

// Built-in parsing runs on the backend's AI key, which costs money. No price: the UI doesn't know it.
defineProps<{ usage?: LlmUsage }>()
const tokens = new Intl.NumberFormat()
</script>

<template>
  <UAlert color="warning" variant="subtle" icon="i-lucide-coins" title="Uses the app’s paid AI key">
    <template #description>
      <p>Each parse is billed to the app’s AI account.</p>
      <template v-if="usage">
        <p data-testid="ai-usage-tokens">
          {{ tokens.format(usage.inputTokens) }} tokens in ·
          {{ tokens.format(usage.outputTokens) }} out
        </p>
        <p data-testid="ai-usage-requests">
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
