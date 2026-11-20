<script setup lang="ts">
import type { LlmUsage } from '~/composables/useLlmUsage'

// Built-in AI costs money: on the app's shared key, or on the owner's own provider account when
// the default model runs on their key. No price: the UI doesn't know it.
const { usage = undefined } = defineProps<{ usage?: LlmUsage }>()
const tokens = new Intl.NumberFormat()
const { models, defaultModel, label } = useLlmModels()
const current = computed(() => models.value.find((m) => m.id === defaultModel.value))
// Only an own key's limit is mentioned here; the shared pool shows in today's usage line.
const { ownKey, cap, state } = useRequestCap(() => usage, current)
const remaining = computed(() => {
  if (!ownKey.value || !cap.value || state.value === 'unlimited') return undefined
  return state.value === 'paused'
    ? 'This key is paused in Settings.'
    : `${cap.value.left ?? 0} requests left today.`
})
</script>

<template>
  <!-- Description in the default text colour: warning-coloured text on the subtle amber
       background is hard to read in light mode. -->
  <UAlert
    :color="ownKey ? 'info' : 'warning'"
    variant="subtle"
    :icon="ownKey ? 'i-lucide-key-round' : 'i-lucide-coins'"
    :title="ownKey ? 'Billed to your API key' : 'Uses the app’s paid AI key'"
    :ui="{ description: 'text-toned space-y-1' }"
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
        <ULink to="/settings#model" class="font-medium underline">Change model</ULink>
      </p>
      <!-- Today's usage on one line; the model only when it differs from the one named above. -->
      <p v-if="usage" class="text-muted">
        Today:
        <span data-testid="ai-usage-requests"
          ><template v-if="usage.model !== defaultModel">{{ label(usage.model) }} · </template
          >{{
            usage.requestsLimit != null
              ? `${usage.requests} of ${usage.requestsLimit}`
              : usage.requests
          }}
          requests</span
        >
        ·
        <span data-testid="ai-usage-tokens"
          >{{ tokens.format(usage.inputTokens) }} tokens in,
          {{ tokens.format(usage.outputTokens) }} out</span
        >
      </p>
    </template>
  </UAlert>
</template>
