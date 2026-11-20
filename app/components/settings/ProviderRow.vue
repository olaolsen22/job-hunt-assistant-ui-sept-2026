<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { LlmCallLimit, ProviderKey } from '~/composables/useProviderKeys'

// One provider: its key and its daily limit together, because a limit only applies to an own key.
// The limit is stored per provider, so it outlives a removed key and shows as "kept".
const {
  providerKey,
  limit = undefined,
  limitDisabled = false
} = defineProps<{
  providerKey: ProviderKey
  limit?: LlmCallLimit
  // Limits still loading or failed: editing would start from "no limit" and overwrite a cap.
  limitDisabled?: boolean
}>()
const emit = defineEmits<{ connect: []; replace: []; remove: []; limit: [] }>()

const name = computed(() => providerLabel(providerKey.provider))
const connected = computed(() => providerKey.configured)
const state = computed(() =>
  limit
    ? capState({
        used: limit.requestsConsumed,
        max: limit.dailyRequestLimit,
        left: limit.remainingRequests
      })
    : 'unlimited'
)

const badge = computed(() => {
  if (!connected.value) return { label: 'Not connected', color: 'neutral' as const }
  if (state.value === 'paused') return { label: 'Paused', color: 'warning' as const }
  if (state.value === 'reached') return { label: 'Limit reached', color: 'error' as const }
  if (state.value === 'near') return { label: 'Near limit', color: 'warning' as const }
  return { label: 'Active', color: 'success' as const }
})

const keptLimit = computed(() => {
  const value = limit?.dailyRequestLimit
  if (value == null) return undefined
  return value === 0 ? 'Limit kept: paused' : `Limit kept: ${value} a day`
})

const menu = computed<DropdownMenuItem[][]>(() =>
  connected.value
    ? [
        [{ label: 'Replace key', icon: 'i-lucide-key-round', onSelect: () => emit('replace') }],
        [
          {
            label: 'Remove key',
            icon: 'i-lucide-trash-2',
            color: 'error',
            onSelect: () => emit('remove')
          }
        ]
      ]
    : [
        [
          {
            label: 'Set limit',
            icon: 'i-lucide-gauge',
            disabled: limitDisabled,
            onSelect: () => emit('limit')
          }
        ]
      ]
)
</script>

<template>
  <li
    class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
    data-testid="provider-row"
  >
    <div class="min-w-0 flex-1 space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium text-highlighted">{{ name }}</span>
        <UBadge :color="badge.color" variant="subtle" data-testid="provider-status">{{
          badge.label
        }}</UBadge>
      </div>

      <template v-if="connected">
        <p class="text-sm text-muted" data-testid="provider-key">
          Key •••• {{ providerKey.last4
          }}<template v-if="providerKey.createdAt">
            · added {{ formatDateTime(providerKey.createdAt) }}</template
          >
        </p>
        <template v-if="limit">
          <p v-if="state === 'paused'" class="text-sm text-muted" data-testid="provider-limit">
            No AI calls on this key until you change the limit.
          </p>
          <p
            v-else-if="state === 'unlimited'"
            class="text-sm text-muted"
            data-testid="provider-limit"
          >
            {{ limit.requestsConsumed }} today · no daily limit
          </p>
          <template v-else>
            <UProgress
              :model-value="limit.requestsConsumed"
              :max="limit.dailyRequestLimit!"
              :color="state === 'reached' ? 'error' : state === 'near' ? 'warning' : 'primary'"
              size="sm"
              class="max-w-xs"
            />
            <p class="text-sm text-muted" data-testid="provider-limit">
              {{ limit.requestsConsumed }} of {{ limit.dailyRequestLimit }} today · resets
              {{ formatDateTime(limit.resetsAt) }}
            </p>
          </template>
        </template>
      </template>
      <template v-else>
        <p class="text-sm text-muted">
          <template v-if="providerKey.provider === 'gemini'"
            >Gemini runs on the app’s key. Use your own to skip the app’s shared cap.</template
          >
          <template v-else>Connect a key to add {{ name }} models.</template>
        </p>
        <p v-if="keptLimit" class="text-sm text-muted" data-testid="provider-limit">
          {{ keptLimit }}
        </p>
      </template>
    </div>

    <div class="flex gap-2">
      <UButton
        v-if="connected"
        color="neutral"
        variant="subtle"
        icon="i-lucide-gauge"
        :disabled="limitDisabled"
        data-testid="provider-limit-edit"
        @click="emit('limit')"
        >{{ limit?.dailyRequestLimit == null ? 'Set limit' : 'Edit limit' }}</UButton
      >
      <UButton
        v-else
        color="neutral"
        variant="subtle"
        icon="i-lucide-plug"
        data-testid="provider-connect"
        @click="emit('connect')"
        >Connect key</UButton
      >
      <UDropdownMenu :items="menu" :content="{ align: 'end' }">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-ellipsis-vertical"
          :aria-label="`More for ${name}`"
          data-testid="provider-menu"
        />
      </UDropdownMenu>
    </div>
  </li>
</template>
